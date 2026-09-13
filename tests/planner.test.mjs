import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {totals,validate,suggest,proteinCounts,advisories,shoppingItems,shoppingSections} from '../planner.mjs';
const recipes=JSON.parse(fs.readFileSync(new URL('../data/recipes.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../data/ingredients.json',import.meta.url)));
test('variable counts are respected, including more than four',()=>{
 for(const n of [1,3,4,7,24]){const selected=suggest(recipes,n);assert.equal(selected.length,n);assert.equal(validate(n,selected),'');}
 assert.match(validate(0,[]),/positive/);assert.match(validate(2.5,[]),/whole/);
 assert.match(validate(3,recipes.slice(0,4)),/3 dinners/);
 assert.equal(suggest(recipes,recipes.length+5).length,recipes.length);
});
test('suggestions preserve chosen recipes and prefer varied unrepeated meals',()=>{
 const locked=[recipes.find(r=>r.id==='thai-basil-chicken')];
 const recent=recipes.slice(0,4).map(r=>r.id).filter(id=>id!==locked[0].id);
 const result=suggest(recipes,4,recent,locked);
 assert.equal(result[0].id,locked[0].id);assert.equal(new Set(result.map(r=>r.id)).size,4);
 assert.ok(!result.some(r=>recent.includes(r.id)));
 assert.equal(new Set(result.map(r=>r.group)).size,2);
});
test('suggestions can exclude a recipe when swapping it out',()=>{
  const locked=['thai-basil-chicken','creamy-tomato-pork-spaghetti','mexican-pork-corn-skillet'].map(id=>recipes.find(r=>r.id===id));
  const result=suggest(recipes,4,[],locked,['vietnamese-caramel-chicken']);
  assert.equal(result.length,4);
  assert.ok(!result.some(r=>r.id==='vietnamese-caramel-chicken'));
  assert.deepEqual(result.slice(0,3).map(r=>r.id),locked.map(r=>r.id));
});
test('suggestions balance protein families around a locked selection',()=>{
 const result=suggest(recipes,5);
 const counts=proteinCounts(result);
 assert.ok(Object.keys(counts).length>=4);
 assert.ok(Math.max(...Object.values(counts))<=2);

 const chickenHeavy=['thai-basil-chicken','creamy-garlic-chicken-pasta','chinese-crispy-sesame-chicken','japanese-chicken-teriyaki'].map(id=>recipes.find(r=>r.id===id));
 const balanced=suggest(recipes,5,[],chickenHeavy);
 assert.equal(balanced.length,5);
 assert.notEqual(balanced.at(-1).protein,'Chicken');
 assert.ok(advisories(chickenHeavy).some(note=>/Protein mix is weighted toward Chicken/.test(note)));
});
test('suggestions avoid previously explored alternatives when asked',()=>{
 const context=['thai-basil-chicken','creamy-garlic-chicken-pasta','chinese-crispy-sesame-chicken','japanese-chicken-teriyaki'].map(id=>recipes.find(r=>r.id===id));
 const first=suggest(recipes,context.length+1,[],context,['thai-basil-chicken']).at(-1);
 const next=suggest(recipes,context.length+1,[],context,['thai-basil-chicken'],{avoidIds:[first.id]});
 assert.notEqual(next.at(-1).id,first.id);
});
test('shared protein, fractional onions, rice and pack remainders aggregate correctly',()=>{
 const chosen=['creamy-tomato-pork-spaghetti','mexican-pork-corn-skillet'].map(id=>recipes.find(r=>r.id===id));
 const rows=totals(chosen,catalog);
 const pork=rows.find(r=>r.key==='pork');assert.equal(pork.amount,450);assert.equal(pork.count,1);assert.equal(pork.left,50);assert.equal(pork.meals.length,2);
 const onion=rows.find(r=>r.key==='onion');assert.equal(onion.amount,1.5);assert.equal(onion.buy,2);assert.equal(onion.left,.5);
 assert.equal(rows.find(r=>r.key==='rice').amount,150);
 assert.equal(totals(chosen,catalog,{pork:400}).find(r=>r.key==='pork').left,350);
 assert.ok(!rows.some(r=>r.key==='water'));
});
test('shopping items retain stable ingredient keys for checklist persistence',()=>{
 const rows=totals(['creamy-tomato-pork-spaghetti','mexican-pork-corn-skillet'].map(id=>recipes.find(r=>r.id===id)),catalog);
 const items=shoppingItems(rows);
 assert.ok(items.some(item=>item.key==='pork'&&item.text.includes('pork mince: need')));
 assert.deepEqual(shoppingSections(rows).flatMap(group=>group.items),items.map(item=>item.text));
});
test('all cards have usable metadata and quantified ingredients',()=>{
 assert.ok(recipes.length>0);
 for(const r of recipes){assert.equal(validate(1,[r]),'');assert.ok(r.steps.length>=4);assert.ok(r.version);for(const i of r.ingredients){assert.ok(catalog[i.key]);assert.ok(i.amount>0);}}
});
