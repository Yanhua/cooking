// Install firebase@12.18.0 and @firebase/rules-unit-testing@5.0.0 in a temporary
// directory, set FIREBASE_TEST_MODULES to its node_modules path, and run under
// firebase emulators:exec --only firestore --project demo-dinner-sorted.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {writeChanges} from '../cloud-store.mjs';
const require=createRequire(`${process.env.FIREBASE_TEST_MODULES}/test.cjs`);
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore');
const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8').replaceAll('REPLACE_WITH_HOUSEHOLD_UID','household-test');
const env=await initializeTestEnvironment({projectId:'demo-dinner-sorted',firestore:{rules}});
after(()=>env.cleanup());
const owner=env.authenticatedContext('household-test').firestore();
const path='households/household-test/records';
const data=(revision=1)=>({payload:'{"ids":[]}',revision,updatedAt:sdk.serverTimestamp()});
test('only the household UID can read and write records',async()=>{
  await assertSucceeds(sdk.setDoc(sdk.doc(owner,path,'draft'),data()));
  await assertSucceeds(sdk.getDoc(sdk.doc(owner,path,'draft')));
  for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('stranger').firestore()]){
    await assertFails(sdk.getDoc(sdk.doc(db,path,'draft')));
    await assertFails(sdk.setDoc(sdk.doc(db,path,'draft'),data(2)));
    await assertFails(sdk.getDocs(sdk.collection(db,path)));
  }
  await assertFails(sdk.setDoc(sdk.doc(owner,'households/stranger/records/draft'),data()));
});
test('rules deny malformed documents, stale revisions and hard deletes',async()=>{
  await assertFails(sdk.setDoc(sdk.doc(owner,path,'draft'),data(1)));
  await assertFails(sdk.setDoc(sdk.doc(owner,path,'draft'),{...data(2),extra:true}));
  await assertFails(sdk.setDoc(sdk.doc(owner,path,'invalid'),data()));
  await assertFails(sdk.deleteDoc(sdk.doc(owner,path,'draft')));
  await assertSucceeds(sdk.setDoc(sdk.doc(owner,path,'draft'),data(2)));
});
test('atomic plan+draft saves reject stale writes without partial updates',async()=>{
  const collection=sdk.collection(owner,path);
  await writeChanges(sdk,owner,collection,[
    {id:'week-2026-09-21',payload:'{"dinners":[["recipe","Dinner"]]}',revision:0},
    {id:'draft',payload:'{"ids":[]}',revision:2},
  ]);
  await assert.rejects(writeChanges(sdk,owner,collection,[
    {id:'week-2026-09-28',payload:'{}',revision:0},
    {id:'draft',payload:'{"ids":["stale"]}',revision:2},
  ]),e=>e.code==='app/conflict');
  assert.equal((await sdk.getDoc(sdk.doc(collection,'week-2026-09-28'))).exists(),false);
  assert.equal((await sdk.getDoc(sdk.doc(collection,'draft'))).data().revision,3);
});
test('separate sessions read saves and cannot resurrect a removed week with stale state',async()=>{
  const second=env.authenticatedContext('household-test').firestore();
  const collection=sdk.collection(second,path);
  assert.equal((await sdk.getDoc(sdk.doc(collection,'week-2026-09-21'))).data().revision,1);
  await writeChanges(sdk,second,collection,[{id:'week-2026-09-21',payload:'null',revision:1}]);
  await assert.rejects(writeChanges(sdk,owner,sdk.collection(owner,path),[{id:'week-2026-09-21',payload:'{}',revision:1}]),e=>e.code==='app/conflict');
});
