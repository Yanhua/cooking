import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {suggest} from '../planner.mjs';

const recipes=JSON.parse(fs.readFileSync(new URL('../data/recipes.json',import.meta.url)));

test('automatic suggestions do not require a pure vegetarian dinner',()=>{
  const result=suggest(recipes,7);
  assert.equal(result.length,7);
  assert.ok(result.every(r=>r.protein!=='Vegetarian'));
});

test('swap-style suggestions keep an explicitly selected vegetarian dinner but do not require another',()=>{
  const current=['thai-basil-chicken','creamy-tomato-pork-spaghetti','mexican-pork-corn-skillet','quick-veggie-pasta']
    .map(id=>recipes.find(r=>r.id===id));
  const replacement=suggest(recipes,current.length+1,[],current,['quick-veggie-pasta'])
    .find(r=>!current.some(selected=>selected.id===r.id));

  assert.ok(current.some(r=>r.protein==='Vegetarian'));
  assert.ok(replacement);
  assert.notEqual(replacement.protein,'Vegetarian');
});
