export const DEFAULT_COUNT = 4;
export const cuisineFamily = recipe => recipe.cuisine.replace(/-inspired$/, '');
export const proteinFamily = recipe => recipe?.protein || 'Other';

const favouredCuisines = new Set(['Thai', 'Chinese']);
const reusableIngredientKeys = new Set([
  'beans', 'bokchoy', 'broccoli', 'cabbage', 'capsicum', 'carrot', 'corn', 'eggplant',
  'fresh-tomato', 'garlic', 'ginger', 'green-beans', 'mushrooms', 'noodles', 'onion',
  'peas', 'pasta', 'potato', 'rice', 'rice-noodles', 'spaghetti', 'spinach', 'zucchini',
]);

const countsBy = (items, key) => items.reduce((counts, item) => {
  const value = key(item);
  counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}, new Map());

const normaliseIds = value => [...new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string') : [])];

export function proteinCounts(selected) {
  return Object.fromEntries(countsBy(selected, proteinFamily));
}

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
  const proteins=Object.entries(proteinCounts(selected)).sort((a,b)=>b[1]-a[1]);
  if(selected.length>2 && proteins[0]?.[1]>=3 && proteins[0][1]>Math.ceil(selected.length/2)) {
    notes.push(`Protein mix is weighted toward ${proteins[0][0]} (${proteins[0][1]} of ${selected.length}). Consider swapping for another protein.`);
  }
  const recent=selected.filter(r=>recentIds.includes(r.id));
  if(recent.length) notes.push(`Recently planned: ${recent.map(r=>r.title).join(', ')}.`);
  return notes;
}
export function suggest(recipes,count,recentIds=[],locked=[],excludedIds=[],options={}) {
  const chosen=[...locked];
  const excluded=new Set(normaliseIds(excludedIds));
  const recent=normaliseIds(recentIds);
  const settings=options&&typeof options==='object'?options:{};
  const avoidIds=normaliseIds(settings.avoidIds);
  const avoidRank=new Map(avoidIds.map((id,index)=>[id,index]));
  const preferredIds=new Set(normaliseIds(settings.preferredIds));
  const candidates=recipes.filter(r=>r.servings===2&&r.activeMinutes<=30&&!excluded.has(r.id)&&!chosen.some(s=>s.id===r.id));
  const proteinSupply=countsBy(candidates,proteinFamily);
  while(chosen.length<count && candidates.length) {
    const proteinUse=countsBy(chosen,proteinFamily);
    const cuisineUse=countsBy(chosen,cuisineFamily);
    const groupUse=countsBy(chosen,r=>r.group);
    const usedIngredients=new Set(chosen.flatMap(r=>r.ingredients.map(i=>i.key)));
    const score=r=>{
      const protein=proteinFamily(r), cuisine=cuisineFamily(r), proteinCount=proteinUse.get(protein)||0;
      const cuisineCount=cuisineUse.get(cuisine)||0, groupCount=groupUse.get(r.group)||0;
      let value=0;

      // A new protein is more valuable than another repeat. Once every available
      // protein has appeared, the negative count keeps repeats balanced.
      value+=(proteinCount===0?36:0)-proteinCount*24;
      value+=Math.min(10,2*Math.log2((proteinSupply.get(protein)||1)+1));

      // Keep cuisine and Asian/Western variety, while still allowing ingredient
      // batching to break close calls.
      value+=(cuisineCount===0?14:0)-cuisineCount*9;
      value+=(groupCount===0?10:0)-groupCount*2;
      if(favouredCuisines.has(cuisine)) value+=2;
      if(preferredIds.has(r.id)) value+=4;
      value+=r.ingredients.reduce((total,i)=>total+(usedIngredients.has(i.key)
        ? (reusableIngredientKeys.has(i.key)?1:.25)
        : 0),0);

      // Recent plans and recently explored swap/suggestion options are soft
      // exclusions: use a genuinely new choice whenever one is available, but
      // never make the library look empty after it has been explored.
      if(recent.includes(r.id)) value-=90;
      const avoidedAt=avoidRank.get(r.id);
      if(avoidedAt!==undefined) value-=72+(avoidIds.length-avoidedAt)*.5;
      return value;
    };
    const remaining=count-chosen.length;
    const fresh=candidates.filter(r=>!recent.includes(r.id));
    const unexplored=fresh.filter(r=>!avoidRank.has(r.id));
    // Prefer a pool with no recent or explored recipes when it can satisfy the
    // remaining slots. The score below is still a soft fallback for small or
    // heavily explored libraries.
    const pool=unexplored.length>=remaining?unexplored:fresh.length>=remaining?fresh:candidates;
    pool.sort((a,b)=>score(b)-score(a)||a.title.localeCompare(b.title));
    const next=pool[0];
    candidates.splice(candidates.indexOf(next),1);
    chosen.push(next);
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
