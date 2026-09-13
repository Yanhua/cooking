import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changesFor,decodeRecords} from '../cloud-store.mjs';
const record=(value,revision=1)=>({payload:JSON.stringify(value),revision});
test('plan JSON round-trips nested arrays and full recipe snapshots',()=>{
  const week={id:'2026-09-21',dinners:[['chicken','Chicken']],snapshots:[{steps:['Cook'],ingredients:[{amount:2}]}],shoppingItems:[{key:'chicken',category:'Meat',text:'Chicken: need 2 g'}],checkedIngredients:{chicken:true}};
  const [change]=changesFor('dinner-plans-v1',[week],{});
  assert.deepEqual(decodeRecords({[change.id]:record(week)},{}).saved,[week]);
});
test('saving feedback changes only its week, preserving other record revisions',()=>{
  const one={id:'2026-09-21',feedback:''},two={id:'2026-09-28',feedback:'Keep'};
  const records={'week-2026-09-21':record(one,3),'week-2026-09-28':record(two,7)};
  assert.deepEqual(changesFor('dinner-plans-v1',[{...one,feedback:'Great'},two],records),[
    {id:'week-2026-09-21',payload:JSON.stringify({...one,feedback:'Great'}),revision:3}
  ]);
});
test('checking an ingredient updates only that week record',()=>{
  const one={id:'2026-09-21',checkedIngredients:{}},two={id:'2026-09-28',checkedIngredients:{rice:true}};
  const records={'week-2026-09-21':record(one,3),'week-2026-09-28':record(two,7)};
  const updated={...one,checkedIngredients:{pork:true}};
  assert.deepEqual(changesFor('dinner-plans-v1',[updated,two],records),[
    {id:'week-2026-09-21',payload:JSON.stringify(updated),revision:3}
  ]);
});
test('moving an edited week keeps the old date tombstoned and the new date versioned',()=>{
  const old={id:'2026-09-21',feedback:'Keep'},moved={id:'2026-10-05',feedback:'Keep'};
  assert.deepEqual(changesFor('dinner-plans-v1',[moved],{'week-2026-09-21':record(old,4)}),[
    {id:'week-2026-10-05',payload:JSON.stringify(moved),revision:0},
    {id:'week-2026-09-21',payload:'null',revision:4},
  ]);
});
test('deletions retain tombstone revision and restoring uses it',()=>{
  const week={id:'2026-09-21'};
  assert.deepEqual(changesFor('dinner-plans-v1',[],{'week-2026-09-21':record(week,2)}),[
    {id:'week-2026-09-21',payload:'null',revision:2}
  ]);
  const records={'week-2026-09-21':record(null,3)};
  assert.deepEqual(decodeRecords(records,{}).saved,[]);
  assert.equal(changesFor('dinner-plans-v1',[week],records)[0].revision,3);
});
test('recipe comments, favourites, draft pack sizes, checklist and suggestion history survive decoding',()=>{
  const draft={date:'2026-09-21',ids:['chicken'],count:1,packs:{chicken:500},checkedIngredients:{chicken:true},suggestionHistory:['pork'],swapHistory:{0:['chicken','pork']}};
  assert.deepEqual(decodeRecords({draft:record(draft),'tried-chicken':record(false),'comment-chicken':record('Use less salt'),'favourite-chicken':record(true)},{}),{saved:[],draft,tried:{chicken:false},comments:{chicken:'Use less salt'},favourites:{chicken:true}});
});
test('recipe preference maps only write changed records and retain tombstone revisions',()=>{
  const records={'comment-chicken':record('Old',3),'favourite-chicken':record(true,4)};
  assert.deepEqual(changesFor('dinner-comments-v1',{chicken:'New'},records),[
    {id:'comment-chicken',payload:JSON.stringify('New'),revision:3}
  ]);
  assert.deepEqual(changesFor('dinner-favourites-v1',{},records),[
    {id:'favourite-chicken',payload:'null',revision:4}
  ]);
});
test('unchanged records produce no writes',()=>{
  assert.deepEqual(changesFor('dinner-draft-v1',{ids:[]},{draft:record({ids:[]})}),[]);
});
