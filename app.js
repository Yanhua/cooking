import { DEFAULT_COUNT, totals, validate, advisories, suggest, fmt, shoppingSections, exportMarkdown } from 'planner';
const app=document.querySelector('#app');
let removedPlan=null;
let recipes=[], published=[], catalog={}, screen={type:'weeks'}, returnScreen={type:'recipes'}, error='', notice='';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{notice='Browser storage is unavailable or full. Keep this page open and export your plan.';return false;}}
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
let saved=read('dinner-plans-v1',[]);if(!Array.isArray(saved))saved=[];
let draft=read('dinner-draft-v1',null);
if(!draft||!Array.isArray(draft.ids))draft={date:today(),count:DEFAULT_COUNT,ids:[],packs:{}};
draft.packs ||= {};
let tried=read('dinner-tried-v1',{});
const status=r=>tried[r.id]===undefined?r.status:(tried[r.id]?'Tried':'Not yet cooked');
let filters={search:'',cuisine:'',protein:'',status:'',time:'30'};
const saveDraft=()=>persist('dinner-draft-v1',draft);
const weeks=()=>[...published.filter(w=>!saved.some(s=>s.id===w.id)),...saved].sort((a,b)=>b.id.localeCompare(a.id));
const recentIds=()=>weeks().filter(w=>w.id<draft.date).slice(0,2).flatMap(w=>w.dinners.map(d=>d[0]));
const selected=()=>draft.ids.map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
const header=(title,sub='')=>`<header class="top"><p class="eyebrow">Home kitchen</p><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p></header>`;
const nav=()=>`<nav class="bottom-nav" aria-label="Main navigation"><button data-nav="weeks" class="nav-button ${screen.type==='weeks'?'active':''}">▣ Weeks</button><button data-nav="recipes" class="nav-button ${screen.type==='recipes'?'active':''}">✦ Recipes</button></nav>`;
const back=()=>'<button class="back" data-action="back">← Back</button>';
const shopping=sections=>sections.map(g=>`<div class="shopping-group"><h3>${esc(g.category)}</h3><ul class="shopping">${g.items.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`).join('');
function options(values,current){return '<option value="">All</option>'+[...new Set(values)].sort().map(v=>`<option ${v===current?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');}
function filterUI(){return `<div class="filters"><label class="wide">Search recipes<input id="search" type="search" value="${esc(filters.search)}" placeholder="Recipe or ingredient"></label><label>Cuisine<select data-filter="cuisine">${options(recipes.map(r=>r.cuisine),filters.cuisine)}</select></label><label>Protein<select data-filter="protein">${options(recipes.map(r=>r.protein),filters.protein)}</select></label><label>Cooking status<select data-filter="status">${options(['Not yet cooked','Tried'],filters.status)}</select></label><label>Active time<select data-filter="time">${[15,20,25,30].map(t=>`<option value="${t}" ${String(t)===filters.time?'selected':''}>≤ ${t} minutes</option>`).join('')}</select></label></div>`;}
function visibleRecipes(){return recipes.filter(r=>(!filters.cuisine||r.cuisine===filters.cuisine)&&(!filters.protein||r.protein===filters.protein)&&(!filters.status||status(r)===filters.status)&&r.activeMinutes<=Number(filters.time)&&`${r.title} ${r.ingredients.map(i=>catalog[i.key].name).join(' ')}`.toLowerCase().includes(filters.search.toLowerCase()));}
function cards(planning){const recent=recentIds();const chosen=selected();const list=visibleRecipes();return list.length?list.map(r=>{const added=draft.ids.includes(r.id);const shared=r.ingredients.filter(i=>catalog[i.key].category!=='Pantry'&&catalog[i.key].category!=='Water'&&chosen.some(s=>s.id!==r.id&&s.ingredients.some(j=>j.key===i.key))).map(i=>catalog[i.key].name);return `<article class="card"><button class="recipe-link" data-recipe="${esc(r.id)}"><h3>${esc(r.title)}</h3></button><p>${esc(r.cuisine)} · ${r.activeMinutes} min active · Serves ${r.servings}</p><p>${esc(status(r))}${recent.includes(r.id)?' · Recently planned':''}</p>${planning?`${shared.length?`<p class="shared">Shares ${esc(shared.join(', '))}</p>`:''}<button class="secondary" data-toggle="${esc(r.id)}" ${!added&&draft.ids.length>=draft.count?'disabled':''}>${added?'Remove':'Add to week'}</button>`:''}</article>`;}).join(''):'<p>No recipes match these filters.</p>';}
function render(keepScroll=false){
  let html='';
  if(error){app.innerHTML=header('Could not load the planner',error)+'<section class="content"><button onclick="location.reload()">Retry</button></section>';return;}
  if(screen.type==='weeks')html=header('Dinner, sorted','Choose dinners from your recipe library.')+`<section class="content"><button class="primary" data-action="plan">${draft.ids.length?'Continue draft':'Plan a week'}</button><h2 class="spaced">Saved weeks</h2>${weeks().map(w=>`<button class="card week-card" data-week="${esc(w.id)}"><span class="date">Week of ${esc(w.id)}</span><h3>${esc(w.title)}</h3><p>${w.mealCount} dinners · 2 people · ≤ 30 min active</p></button>`).join('')||'<p>No saved weeks yet.</p>'}<p class="sub">New plans are saved in this browser. Export them to keep a repository copy.</p></section>`;
  if(screen.type==='recipes')html=header('Recipe library',`${recipes.length} recipes, ready to choose.`)+`<section class="content">${filterUI()}<div id="recipe-results">${cards(false)}</div></section>`;
  if(screen.type==='plan'){
    const chosen=selected(), problem=validate(draft.count,chosen);
    html=header('Plan a week','Pick your dinners, then review the shopping list.')+`<section class="content"><div class="filters"><label>Week beginning<input id="week-date" type="date" value="${esc(draft.date)}"></label><label>Number of dinners<input id="meal-count" type="number" min="1" step="1" value="${esc(draft.count)}"></label></div><div class="selection"><h2>${chosen.length} / ${esc(draft.count)} dinners selected</h2>${chosen.map(r=>`<div class="chosen"><button class="recipe-link" data-recipe="${esc(r.id)}">${esc(r.title)}</button><button class="secondary" data-toggle="${esc(r.id)}" aria-label="Remove ${esc(r.title)}">Remove</button></div>`).join('')}<div class="actions"><button class="secondary" data-action="suggest">Suggest remaining dinners</button><button class="primary" data-action="review" ${problem?'disabled':''}>Review week</button></div>${problem?`<p class="sub">${esc(problem)}</p>`:''}</div>${filterUI()}<div id="recipe-results">${cards(true)}</div></section>`;
  }
  if(screen.type==='review'){
    const chosen=selected(), rows=totals(chosen,catalog,draft.packs);
    html=header('Review your week',`${chosen.length} dinners for two · ${draft.date}`)+`<section class="content">${back()}<ol>${chosen.map(r=>`<li>${esc(r.title)}</li>`).join('')}</ol>${advisories(chosen,recentIds()).map(s=>`<p class="advice">${esc(s)}</p>`).join('')}<h2 class="spaced">Shopping list</h2>${shopping(shoppingSections(rows))}<details><summary>Adjust pack sizes</summary><p class="sub">These are editable shopping estimates; available packs vary by supermarket. Garlic assumes 10 cloves per bulb.</p>${rows.filter(r=>r.pack).map(r=>`<label class="pack-label">${esc(r.name)} (${esc(r.unit)} per pack)<input type="number" min="0.01" step="any" data-pack="${r.key}" value="${r.pack}"></label>`).join('')}</details><h2 class="spaced">Ingredient reuse</h2>${reuseHTML(rows)}<button class="primary" data-action="save">Save week</button></section>`;
  }
  if(screen.type==='week'){
    const w=weeks().find(w=>w.id===screen.id);
    if(!w){screen={type:'weeks'};return render();}
    html=header(`Week of ${w.id}`,`${w.mealCount} dinners · 2 people`)+`<section class="content">${back()}${w.dinners.map(([id,name])=>`<article class="dinner-row"><h3>${esc(name)}</h3><button data-recipe="${esc(id)}" data-snapshot="${esc(w.id)}">Open saved recipe →</button></article>`).join('')}<h2 class="spaced">Shopping list</h2>${shopping(w.shopping)}<h2 class="spaced">Ingredient reuse</h2><ul class="reuse">${w.reuse.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><h2 class="spaced">After cooking</h2><label>Ratings, changes and whether to repeat<textarea id="feedback" rows="4">${esc(w.feedback||'')}</textarea></label><button class="secondary" data-action="feedback">Save feedback</button><div class="actions"><button class="primary" data-action="export">Export plan (.json)</button><button class="secondary" data-action="markdown">Export plan (.md)</button></div>${saved.some(s=>s.id===w.id)?'<button class="secondary" data-action="remove-local">Remove browser copy</button>':''}<p class="sub">JSON includes recipe snapshots and shopping totals. Save it in weeks/ and run the data builder to publish it.</p></section>`;
  }
  if(screen.type==='export'){
    const w=weeks().find(w=>w.id===screen.id), json=screen.format==='json';
    const body=json?JSON.stringify(w,null,2):exportMarkdown(w);
    html=header('Export your plan',`${w.id}.${screen.format}`)+`<section class="content">${back()}<p>Download the file, or copy the text below if your browser does not support downloads.</p><a class="primary download" download="${esc(w.id)}.${screen.format}" href="data:${json?'application/json':'text/markdown'};charset=utf-8,${encodeURIComponent(body)}">Download ${screen.format.toUpperCase()}</a><label>Plan export<textarea id="export-text" rows="16" readonly>${esc(body)}</textarea></label><button class="secondary" data-action="select-export">Select export text</button></section>`;
  }
  if(screen.type==='recipe'){
    const r=screen.snapshot?weeks().find(w=>w.id===screen.snapshot)?.snapshots?.find(r=>r.id===screen.id):recipes.find(r=>r.id===screen.id);
    html=header(r?.title||'Recipe unavailable')+`<section class="content">${back()}${r?`<p>${esc(r.cuisine)} · ${r.activeMinutes} min active · Serves ${r.servings}</p><p class="sub">${esc(status(r))} · ${esc(r.equipment.join(', '))}${screen.snapshot?' · Saved recipe version':''}</p>${r.notes?`<p class="advice">${esc(r.notes)}</p>`:''}${!screen.snapshot?`<button class="secondary" data-action="tried">${status(r)==='Tried'?'Mark as not yet cooked':'Mark as tried'}</button>`:''}<h2 class="spaced">Ingredients</h2><div class="ingredients">${r.ingredients.map(i=>`<div class="ingredient-row"><span class="ingredient-quantity">${fmt(i.amount)} ${esc(i.unit||catalog[i.key]?.unit||'')}</span><span>${esc(i.name||catalog[i.key]?.name||i.key)}</span></div>`).join('')}</div><h2 class="spaced">Method</h2><ol class="steps">${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:'<p>This saved recipe could not be found.</p>'}</section>`;
  }
  app.innerHTML=html+ (notice?`<p class="notice" role="status">${esc(notice)}</p>`:'') +(removedPlan?'<div class="content"><button class="secondary" data-action="undo-remove">Undo removal</button></div>':'')+nav();
  if(!keepScroll)window.scrollTo(0,0);
}
function reuse(rows){return rows.filter(r=>r.meals.length>1).map(r=>`${r.name}: ${fmt(r.amount)} ${r.unit} across ${r.meals.join('; ')}`);}
function reuseHTML(rows){const lines=reuse(rows);return lines.length?`<ul class="reuse">${lines.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:'<p>No shared ingredients in this selection.</p>';}

app.addEventListener('input',e=>{if(e.target.id==='meal-count'){const n=Number(e.target.value);if(Number.isSafeInteger(n)&&n>0){draft.count=n;notice=n<draft.ids.length?'Remove dinners to match the new count. Your selections have been kept.':'';saveDraft();render(true);document.querySelector('#meal-count').focus();}return;}if(e.target.id==='week-date'&&e.target.value){draft.date=e.target.value;saveDraft();return;}if(e.target.id==='search'){filters.search=e.target.value;document.querySelector('#recipe-results').innerHTML=cards(screen.type==='plan');}});
app.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.filter){filters[el.dataset.filter]=el.value;render(true);}
  if(el.id==='week-date'){if(el.value)draft.date=el.value;saveDraft();render(true);}
  if(el.id==='meal-count'){
    const n=Number(el.value);
    if(!Number.isSafeInteger(n)||n<1){notice='Enter a positive whole number of dinners.';render(true);return;}
    draft.count=n;notice=n<draft.ids.length?'Remove dinners to match the new count. Your selections have been kept.':'';saveDraft();render(true);
  }
  if(el.dataset.pack){const n=Number(el.value);if(n>0&&Number.isFinite(n)){draft.packs[el.dataset.pack]=n;saveDraft();}render(true);}
});
app.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const a=b.dataset.action;
  if(b.dataset.nav){screen={type:b.dataset.nav};notice='';}
  else if(b.dataset.week)screen={type:'week',id:b.dataset.week};
  else if(b.dataset.recipe){returnScreen={...screen};screen={type:'recipe',id:b.dataset.recipe,snapshot:b.dataset.snapshot};}
  else if(b.dataset.toggle){const id=b.dataset.toggle;if(draft.ids.includes(id))draft.ids=draft.ids.filter(v=>v!==id);else if(draft.ids.length<draft.count)draft.ids.push(id);saveDraft();render(true);return;}
  else if(a==='back')screen=screen.type==='recipe'?returnScreen:screen.type==='review'?{type:'plan'}:screen.type==='export'?{type:'week',id:screen.id}:{type:'weeks'};
  else if(a==='plan')screen={type:'plan'};
  else if(a==='suggest'){
    if(draft.count<draft.ids.length){notice='Remove dinners to match your chosen count first.';}
    else {draft.ids=suggest(recipes,draft.count,recentIds(),selected()).map(r=>r.id);notice=draft.ids.length<draft.count?'The library does not have enough different recipes for this count. Add recipes separately or choose fewer dinners.':'';saveDraft();}
  }
  else if(a==='review'){if(!validate(draft.count,selected()))screen={type:'review'};}
  else if(a==='save'){
    const problem=validate(draft.count,selected());if(problem){notice=problem;render();return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)){notice='Choose a week date.';render();return;}
    if(weeks().some(w=>w.id===draft.date)){notice='A plan already exists for this date. Choose another date in the planner to keep both plans.';render();return;}
    const rows=totals(selected(),catalog,draft.packs);
    const w={id:draft.date,title:'Dinners from the recipe library',mealCount:draft.count,dinners:selected().map(r=>[r.id,r.title]),snapshots:JSON.parse(JSON.stringify(selected().map(r=>({...r,status:status(r),ingredients:r.ingredients.map(i=>({...i,name:catalog[i.key].name,unit:catalog[i.key].unit}))})))),shopping:shoppingSections(rows),reuse:reuse(rows),packSizes:{...draft.packs},feedback:''};
    saved.push(w);const ok=persist('dinner-plans-v1',saved);screen={type:'week',id:w.id};draft={date:today(),count:w.mealCount,ids:[],packs:{}};saveDraft();if(ok)notice='Week saved in this browser. Export a copy to keep in the repository.';
  }
  else if(a==='remove-local'){removedPlan=saved.find(w=>w.id===screen.id);saved=saved.filter(w=>w.id!==screen.id);persist('dinner-plans-v1',saved);screen={type:'weeks'};notice='Browser copy removed. Published plans remain available.';}
  else if(a==='undo-remove'){if(removedPlan){saved.push(removedPlan);persist('dinner-plans-v1',saved);removedPlan=null;notice='Browser copy restored.';}}
  else if(a==='tried'){const r=recipes.find(r=>r.id===screen.id);tried[r.id]=status(r)!=='Tried';if(persist('dinner-tried-v1',tried))notice='Cooking status saved in this browser.';}
  else if(a==='feedback'){
    const w=JSON.parse(JSON.stringify(weeks().find(w=>w.id===screen.id)));w.feedback=document.querySelector('#feedback').value;saved=saved.filter(s=>s.id!==w.id).concat(w);if(persist('dinner-plans-v1',saved))notice='Feedback saved in this browser; export to update the repository.';
  }
  else if(a==='export'||a==='markdown'){
    screen={type:'export',id:screen.id,format:a==='export'?'json':'md'};
  }
  else if(a==='select-export'){document.querySelector('#export-text').select();return;}
  else return;
  render();
});
app.innerHTML=header('Dinner, sorted','Loading the recipe library…');
Promise.all(['recipes','weeks','ingredients'].map(async name=>{const response=await fetch(`./data/${name}.json`,{cache:'no-cache'});if(!response.ok)throw new Error(`Could not load ${name}. Serve this folder over HTTP and run scripts/build-data.py after content changes.`);return response.json();})).then(([r,w,c])=>{recipes=r;published=w;catalog=c;const missing=draft.ids.filter(id=>!recipes.some(r=>r.id===id));if(missing.length){draft.ids=draft.ids.filter(id=>recipes.some(r=>r.id===id));notice='Some draft recipes are no longer in the library. Please choose replacements.';saveDraft();}}).catch(e=>error=e.message).finally(()=>render());
