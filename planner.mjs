export const DEFAULT_COUNT = 4;
export const cuisineFamily = recipe => recipe.cuisine.replace(/-inspired$/, '');
export function totals(recipes, catalog, packs = {}) {
  const sums = new Map();
  for (const r of recipes) for (const i of r.ingredients) {
    if (!catalog[i.key]) throw new Error(`Unknown ingredient: ${i.key}`);
    const row = sums.get(i.key) || { key:i.key, ...catalog[i.key], amount:0, meals:[] };
    row.amount += i.amount;
    if (!row.meals.includes(r.title)) row.meals.push(r.title);
    sums.set(i.key,row);
  }
  return [...sums.values()].filter(i=>i.category!=='Water').map(i=>{
    const pack = Number(packs[i.key]) > 0 ? Number(packs[i.key]) : i.pack;
    const count = pack ? Math.ceil((i.amount - 1e-8)/pack) : null;
    return {...i,pack,count,buy:pack ? count*pack : i.amount,left:pack ? Math.max(0,count*pack-i.amount) : 0};
  }).sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
}
export function validate(count, selected) {
  if (!Number.isInteger(count)||count<1) return 'Choose a positive whole number of dinners.';
  if (selected.length!==count) return `Choose ${count} dinners; ${selected.length} selected.`;
  if (new Set(selected.map(r=>r.id)).size!==selected.length) return 'Choose different recipes for each dinner.';
  if (selected.some(r=>r.servings!==2||r.activeMinutes>30)) return 'Dinners must serve two and take at most 30 minutes active cooking.';
  return '';
}
export function advisories(selected,recentIds=[]) {
  const notes=[];
  if(new Set(selected.map(cuisineFamily)).size<selected.length) notes.push('Some cuisines repeat. Swap a dinner if you would like more variety.');
  if(selected.length>1 && new Set(selected.map(r=>r.group)).size<2) notes.push('Consider mixing Asian and Western dinners.');
  const recent=selected.filter(r=>recentIds.includes(r.id));
  if(recent.length) notes.push(`Recently planned: ${recent.map(r=>r.title).join(', ')}.`);
  return notes;
}
export function suggest(recipes,count,recentIds=[],locked=[],excludedIds=[]) {
  const chosen=[...locked];
  const excluded=new Set(excludedIds);
  const candidates=recipes.filter(r=>r.servings===2&&r.activeMinutes<=30&&!excluded.has(r.id)&&!chosen.some(s=>s.id===r.id));
  while(chosen.length<count && candidates.length) {
    const score=r=> (recentIds.includes(r.id)?-20:0) + (chosen.some(s=>cuisineFamily(s)===cuisineFamily(r))?-8:8) + (chosen.some(s=>s.group===r.group)?0:5) + (['Thai','Chinese'].includes(cuisineFamily(r))?2:0) + r.ingredients.reduce((score,i)=>score+(chosen.some(s=>s.ingredients.some(j=>j.key===i.key)) ? (['chicken','pork','beef','tofu'].includes(i.key)?6:['onion','garlic','rice','oil','soy','sugar','salt','pepper','water'].includes(i.key)?.1:1) : 0),0);
    candidates.sort((a,b)=>score(b)-score(a)||a.title.localeCompare(b.title));
    chosen.push(candidates.shift());
  }
  return chosen;
}
export const fmt = n => String(Number(n.toFixed(2)));
export function shoppingSections(rows) {
  const groups={};
  for(const r of rows) {
    const category=r.category==='Pantry'?'Pantry check':r.category;
    (groups[category] ||= []).push(`${r.name}: need ${fmt(r.amount)} ${r.unit}${r.pack?`; ${r.category==='Pantry'?'if needed, ':''}buy ${r.count} × ${fmt(r.pack)} ${r.unit}; ${fmt(r.left)} ${r.unit} remaining`:''}`);
  }
  return Object.entries(groups).map(([category,items])=>({category,items}));
}
export function exportMarkdown(w) {
  return `# Dinner plan — ${w.id}\n\n${w.mealCount} dinners · 2 people\n\n## Dinners\n\n` + w.snapshots.map((r,i)=>`${i+1}. [${r.title}](../${r.path}) — ${r.cuisine}; ${r.activeMinutes} min active; recipe version ${r.version}`).join('\n') + '\n\n## Ingredient-reuse map\n\n'+w.reuse.map(s=>`- ${s}`).join('\n')+'\n\n## Shopping list\n\n'+w.shopping.map(g=>`### ${g.category}\n\n${g.items.map(s=>`- ${s}`).join('\n')}`).join('\n\n')+'\n\n## Post-cooking notes\n\n'+(w.feedback||'| Dinner | Rating / notes | Repeat? |\n|---|---|---|\n'+w.snapshots.map(r=>`| ${r.title} | | |`).join('\n'))+'\n';
}
