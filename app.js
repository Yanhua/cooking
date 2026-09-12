import { DEFAULT_COUNT, totals, validate, advisories, suggest, fmt, shoppingSections, exportMarkdown } from 'planner';
import { connectCloud, changesFor, decodeRecords } from 'cloud-store';
const app=document.querySelector('#app');
let removedPlan=null;
let recipes=[], catalog={}, recipePhotos=new Map(), screen={type:'weeks'}, returnScreen={type:'recipes'}, error='', notice='';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scenePhotos={
  home:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=84',
  library:'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=84',
  shopping:'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=1200&q=84'
};
const hash=value=>[...String(value)].reduce((total,char)=>((total*31)+char.charCodeAt(0))>>>0,0);
const foodishSizes={biryani:81,burger:87,'butter-chicken':22,pasta:34,rice:35,samosa:22};
const photoCategory=recipe=>{
  const title=String(recipe?.title||'').toLowerCase();
  if(/noodle|chow mein|pasta|spaghetti/.test(title))return 'pasta';
  if(/curry|stew|hot pot/.test(title))return 'butter-chicken';
  if(/rice|bowl|lu rou/.test(title))return 'rice';
  if(/gyoza/.test(title))return 'samosa';
  return /chinese|japanese|korean|thai|vietnamese|taiwanese|malaysian|singapore|asian/i.test(recipe?.cuisine||'')?'biryani':'burger';
};
const foodishPhoto=(category,number)=>`https://raw.githubusercontent.com/surhud004/Foodish/main/public/assets/images/${category}/${category}${number}.jpg`;
function assignRecipePhotos(list){
  const assigned=new Map(),used=new Set(),ordered=[...list].sort((a,b)=>a.id.localeCompare(b.id));
  for(const recipe of ordered){
    const category=photoCategory(recipe),size=foodishSizes[category];
    let number=(hash(recipe.id)%size)+1,attempts=0,url=foodishPhoto(category,number);
    while(used.has(url)&&attempts<size){number=(number%size)+1;url=foodishPhoto(category,number);attempts++;}
    if(used.has(url)){
      for(const [fallback,fallbackSize] of Object.entries(foodishSizes)){
        for(let i=1;i<=fallbackSize;i++){const candidate=foodishPhoto(fallback,i);if(!used.has(candidate)){url=candidate;break;}}
        if(!used.has(url))break;
      }
    }
    used.add(url);assigned.set(recipe.id,url);
  }
  return assigned;
}
const recipeImage=recipe=>{
  const identity=recipe?.id||recipe?.title||'dinner';
  const category=photoCategory(recipe),number=(hash(identity)%foodishSizes[category])+1;
  return recipePhotos.get(identity)||foodishPhoto(category,number);
};
const remoteImage=(src,alt='',className='')=>`<img class="${className}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-remote-image>`;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
let cloud=null, config=null, signedIn=false, ready=false, busy=false, authError='', records={}, incoming=null, feedbackEdit=null, commentEdit=null, devAuthPassword='';
const emptyDraft=()=>({date:today(),count:DEFAULT_COUNT,ids:[],packs:{}});
let legacy=null;
function applyRecords(next) {
  records=next;
  ({saved,tried,comments,favourites,draft}=decodeRecords(records,emptyDraft()));
  draft.packs ||= {};
  ready=true;
}
async function persist(key,value){
  if(!ready || !signedIn) throw new Error('Unlock the planner and wait for your saved data to load.');
  const changes=changesFor(key,value,records);
  await cloud.save(changes);
  for(const change of changes) records[change.id]={payload:change.payload,revision:change.revision+1};
  return true;
}
function saveMessage(e){
  if(e.code==='app/conflict')return e.message;
  if(e.code==='permission-denied')return 'Saving was denied. Check the household account and database rules.';
  return 'Could not save to the cloud. Check your connection and try again. Your last saved data has been kept.';
}
async function mutate(action){
  if(busy || !ready)return;
  const before=JSON.stringify({saved,draft,tried,comments,favourites});
  busy=true;
  const controls=app.querySelector('fieldset');if(controls)controls.disabled=true;
  const sync=app.querySelector('#sync-status');if(sync)sync.textContent='Saving…';
  try{await action();if(incoming && !feedbackEdit && !commentEdit){const merged={...incoming};for(const [id,r] of Object.entries(records))if(!merged[id]||r.revision>merged[id].revision)merged[id]=r;applyRecords(merged);incoming=null;}}
  catch(e){({saved,draft,tried,comments,favourites}=JSON.parse(before));notice=saveMessage(e);}
  finally{busy=false;render(true);}
}
function receiveRecords(next){
  if((busy && ready) || feedbackEdit || commentEdit || ['week-date','meal-count'].includes(document.activeElement?.id) || document.activeElement?.dataset.pack){incoming=next;return;}
  applyRecords(next);render(true);
}
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
async function loadDevAuthPassword(){
  if(!['localhost','127.0.0.1','::1'].includes(location.hostname))return '';
  try{
    const response=await fetch('/__dev/auth.json',{cache:'no-store'});
    if(!response.ok)return '';
    const data=await response.json();
    return typeof data.password==='string'?data.password:'';
  }catch{return '';}
}
legacy={saved:read('dinner-plans-v1',[]),draft:read('dinner-draft-v1',null),tried:read('dinner-tried-v1',{})};
if(!Array.isArray(legacy.saved))legacy.saved=[];
if(!legacy.draft || !Array.isArray(legacy.draft.ids))legacy.draft=null;
if(!legacy.tried || typeof legacy.tried!=='object')legacy.tried={};
let saved=[], draft=emptyDraft(), tried={}, comments={}, favourites={};
const status=r=>tried[r.id]===undefined?r.status:(tried[r.id]?'Tried':'Not yet cooked');
const commentFor=r=>typeof comments[r.id]==='string'?comments[r.id]:'';
const isFavourite=r=>favourites[r.id]===true;
let filters={search:'',cuisine:'',protein:'',status:'',time:'30'};
const saveDraft=()=>persist('dinner-draft-v1',draft);
const weeks=()=>[...saved].sort((a,b)=>b.id.localeCompare(a.id));
const recentIds=()=>weeks().filter(w=>w.id<draft.date).slice(0,2).flatMap(w=>w.dinners.map(d=>d[0]));
const selected=()=>draft.ids.map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
const header=(title,sub='',image=scenePhotos.home)=>`<header class="top visual-header" style="--header-image:url('${image}')"><div class="header-copy"><p class="eyebrow">Home kitchen</p><h1>${esc(title)}</h1>${sub?`<p class="sub">${esc(sub)}</p>`:''}</div></header>`;
const nav=()=>`<nav class="bottom-nav" aria-label="Main navigation"><button data-nav="weeks" class="nav-button ${screen.type==='weeks'?'active':''}">▣ Weeks</button><button data-nav="recipes" class="nav-button ${screen.type==='recipes'?'active':''}">✦ Recipes</button></nav>`;
const back=()=>'<button class="back" data-action="back">← Back</button>';
const shopping=sections=>sections.map(g=>`<div class="shopping-group"><h3>${esc(g.category)}</h3><ul class="shopping">${g.items.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`).join('');
function options(values,current){return '<option value="">All</option>'+[...new Set(values)].sort().map(v=>`<option ${v===current?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');}
function filterUI(){return `<div class="filters recipe-filters"><label class="wide">Search recipes<input id="search" type="search" value="${esc(filters.search)}" placeholder="Recipe or ingredient"></label><label>Cuisine<select data-filter="cuisine">${options(recipes.map(r=>r.cuisine),filters.cuisine)}</select></label><label>Protein<select data-filter="protein">${options(recipes.map(r=>r.protein),filters.protein)}</select></label><label>Cooking status<select data-filter="status">${options(['Not yet cooked','Tried'],filters.status)}</select></label><label>Active time<select data-filter="time">${[15,20,25,30].map(t=>`<option value="${t}" ${String(t)===filters.time?'selected':''}>≤ ${t} minutes</option>`).join('')}</select></label></div>`;}
function visibleRecipes(){return recipes.filter(r=>(!filters.cuisine||r.cuisine===filters.cuisine)&&(!filters.protein||r.protein===filters.protein)&&(!filters.status||status(r)===filters.status)&&r.activeMinutes<=Number(filters.time)&&`${r.title} ${r.ingredients.map(i=>catalog[i.key].name).join(' ')}`.toLowerCase().includes(filters.search.toLowerCase())).sort((a,b)=>Number(isFavourite(b))-Number(isFavourite(a)));}
function cards(planning){const recent=recentIds();const chosen=selected();const list=visibleRecipes();return list.length?list.map(r=>{const added=draft.ids.includes(r.id);const shared=r.ingredients.filter(i=>catalog[i.key].category!=='Pantry'&&catalog[i.key].category!=='Water'&&chosen.some(s=>s.id!==r.id&&s.ingredients.some(j=>j.key===i.key))).map(i=>catalog[i.key].name);return `<article class="card recipe-card"><div class="recipe-thumb">${remoteImage(recipeImage(r),'')}</div><div class="recipe-card-body"><div class="recipe-card-header"><button class="recipe-link" data-recipe="${esc(r.id)}"><h3>${esc(r.title)}</h3></button><button class="favourite-button ${isFavourite(r)?'selected':''}" data-favourite="${esc(r.id)}" aria-label="${isFavourite(r)?'Remove':'Mark'} ${esc(r.title)} as favourite" aria-pressed="${isFavourite(r)}">★</button></div><p>${esc(r.cuisine)} · ${r.activeMinutes} min active · Serves ${r.servings}</p><p>${esc(status(r))}${recent.includes(r.id)?' · Recently planned':''}</p>${planning?`${shared.length?`<p class="shared">Shares ${esc(shared.join(', '))}</p>`:''}<button class="secondary" data-toggle="${esc(r.id)}" ${!added&&draft.ids.length>=draft.count?'disabled':''}>${added?'Remove':'Add to week'}</button>`:''}</div></article>`;}).join(''):'<div class="empty-state"><span aria-hidden="true">🍽️</span><p>No recipes match these filters.</p></div>';}
function render(keepScroll=false){
  if(!config){app.innerHTML=header('Dinner, sorted','Connecting…');return;}
  if(!config.firebase?.apiKey || !config.firebase?.authDomain || !config.firebase?.projectId || !config.firebase?.appId || !config.householdUid || !config.householdEmail){
    app.innerHTML=header('Could not connect','Cloud saving is not configured.')+'<section class="content"><p>Check the deployed application configuration, then reload.</p><button class="secondary" data-action="reload">Retry</button></section>';return;
  }
  if(!signedIn){app.innerHTML=header('Welcome home','Enter your household password to open the planner.')+`<section class="content"><form id="unlock-form"><label>Household password<input id="password" name="password" type="password" autocomplete="current-password" required ${busy?'disabled':''}></label><button class="primary" type="submit" ${busy||!cloud?'disabled':''}>${busy?'Unlocking…':'Unlock planner'}</button><p class="sub">This device will stay signed in until you lock it.</p>${authError?`<p class="notice" role="alert">${esc(authError)}</p>`:''}</form></section>`;return;}
  if(!ready){app.innerHTML=header('Dinner, sorted',error||'Loading your saved plans…')+'<section class="content"><button class="secondary" data-action="reload">Retry</button><button class="secondary" data-action="lock">Lock planner</button></section>';return;}
  let html='';
  if(error){app.innerHTML=header('Could not load the planner',error)+'<section class="content"><button onclick="location.reload()">Retry</button></section>';return;}
  if(screen.type==='weeks')html=header('Dinner, sorted','Choose dinners from your recipe library.',scenePhotos.home)+`<section class="content"><button class="primary" data-action="plan">${draft.ids.length?'Continue draft':'Plan a week'}</button><h2 class="spaced">Saved weeks</h2>${weeks().map(w=>`<button class="card week-card" data-week="${esc(w.id)}"><span class="week-card-image">${remoteImage(recipeImage(w.snapshots?.[0]||{id:w.id}),'')}</span><span class="week-card-copy"><span class="date">Week of ${esc(w.id)}</span><strong>${esc(w.title)}</strong><small>${w.mealCount} dinners · 2 people · ≤ 30 min active</small></span></button>`).join('')||'<div class="empty-state"><span aria-hidden="true">🗓️</span><p>No saved weeks yet. Your first plan will appear here.</p></div>'}<p class="sub">Plans and feedback sync across your devices.</p></section>`;
  if(screen.type==='recipes')html=header('Recipe library',`${recipes.length} recipes, ready to choose.`,scenePhotos.library)+`<section class="content">${filterUI()}<div id="recipe-results">${cards(false)}</div></section>`;
  if(screen.type==='plan'){
    const chosen=selected(), problem=validate(draft.count,chosen);
    html=header('Plan a week','Pick your dinners, then review the shopping list.',scenePhotos.library)+`<section class="content"><div class="filters"><label>Week beginning<input id="week-date" type="date" value="${esc(draft.date)}"></label><label>Number of dinners<input id="meal-count" type="number" min="1" step="1" value="${esc(draft.count)}"></label></div><div class="selection"><h2>${chosen.length} / ${esc(draft.count)} dinners selected</h2>${chosen.map(r=>`<div class="chosen"><span class="chosen-thumb">${remoteImage(recipeImage(r),'')}</span><button class="recipe-link" data-recipe="${esc(r.id)}">${esc(r.title)}</button><button class="secondary" data-swap="${esc(r.id)}" aria-label="Swap ${esc(r.title)} for another dinner">Swap</button><button class="secondary" data-toggle="${esc(r.id)}" aria-label="Remove ${esc(r.title)}">Remove</button></div>`).join('')}<div class="actions"><button class="secondary" data-action="suggest">Suggest remaining dinners</button><button class="primary" data-action="review" ${problem?'disabled':''}>Review week</button></div>${problem?`<p class="sub">${esc(problem)}</p>`:''}</div>${filterUI()}<div id="recipe-results">${cards(true)}</div></section>`;
  }
  if(screen.type==='review'){
    const chosen=selected(), rows=totals(chosen,catalog,draft.packs);
    html=header('Review your week',`${chosen.length} dinners for two · ${draft.date}`,scenePhotos.shopping)+`<section class="content">${back()}<div class="meal-gallery">${chosen.map(r=>`<figure>${remoteImage(recipeImage(r),'')}<figcaption>${esc(r.title)}</figcaption></figure>`).join('')}</div>${advisories(chosen,recentIds()).map(s=>`<p class="advice">${esc(s)}</p>`).join('')}<h2 class="spaced">Shopping list</h2>${shopping(shoppingSections(rows))}<details><summary>Adjust pack sizes</summary><p class="sub">These are editable shopping estimates; available packs vary by supermarket. Garlic assumes 10 cloves per bulb.</p>${rows.filter(r=>r.pack).map(r=>`<label class="pack-label">${esc(r.name)} (${esc(r.unit)} per pack)<input type="number" min="0.01" step="any" data-pack="${r.key}" value="${r.pack}"></label>`).join('')}</details><h2 class="spaced">Ingredient reuse</h2>${reuseHTML(rows)}<button class="primary" data-action="save">Save week</button></section>`;
  }
  if(screen.type==='week'){
    const w=weeks().find(w=>w.id===screen.id);
    if(!w){screen={type:'weeks'};return render();}
    html=header(`Week of ${w.id}`,`${w.mealCount} dinners · 2 people`,recipeImage(w.snapshots?.[0]||{id:w.id}))+`<section class="content">${back()}${w.dinners.map(([id,name])=>{const recipe=w.snapshots?.find(r=>r.id===id)||{id,title:name};return `<article class="dinner-row"><span class="dinner-thumb">${remoteImage(recipeImage(recipe),'')}</span><span><h3>${esc(name)}</h3><button data-recipe="${esc(id)}" data-snapshot="${esc(w.id)}">Open saved recipe →</button></span></article>`;}).join('')}<h2 class="spaced">Shopping list</h2>${shopping(w.shopping)}<h2 class="spaced">Ingredient reuse</h2><ul class="reuse">${w.reuse.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><h2 class="spaced">After cooking</h2><label>Ratings, changes and whether to repeat<textarea id="feedback" rows="4">${esc(feedbackEdit?.id===w.id?feedbackEdit.text:w.feedback||'')}</textarea></label><button class="secondary" data-action="feedback">Save feedback</button><div class="actions"><button class="primary" data-action="export">Export plan (.json)</button><button class="secondary" data-action="markdown">Export plan (.md)</button></div>${saved.some(s=>s.id===w.id)?'<button class="secondary" data-action="remove-local">Remove saved week</button>':''}<p class="sub">JSON includes recipe snapshots and shopping totals. Keep it as a backup or share it privately with your household.</p></section>`;
  }
  if(screen.type==='export'){
    const w=weeks().find(w=>w.id===screen.id), json=screen.format==='json';
    const body=json?JSON.stringify(w,null,2):exportMarkdown(w);
    html=header('Export your plan',`${w.id}.${screen.format}`)+`<section class="content">${back()}<p>Download the file, or copy the text below if your browser does not support downloads.</p><a class="primary download" download="${esc(w.id)}.${screen.format}" href="data:${json?'application/json':'text/markdown'};charset=utf-8,${encodeURIComponent(body)}">Download ${screen.format.toUpperCase()}</a><label>Plan export<textarea id="export-text" rows="16" readonly>${esc(body)}</textarea></label><button class="secondary" data-action="select-export">Select export text</button></section>`;
  }
  if(screen.type==='recipe'){
    const r=screen.snapshot?weeks().find(w=>w.id===screen.snapshot)?.snapshots?.find(r=>r.id===screen.id):recipes.find(r=>r.id===screen.id);
    html=header(r?.title||'Recipe unavailable','',r?recipeImage(r):scenePhotos.home)+`<section class="content">${back()}${r?`<p class="recipe-summary">${esc(r.cuisine)} · ${r.activeMinutes} min active · Serves ${r.servings}</p><p class="sub">${esc(status(r))} · ${esc(r.equipment.join(', '))}${screen.snapshot?' · Saved recipe version':''}</p>${r.notes?`<p class="advice">${esc(r.notes)}</p>`:''}<div class="recipe-actions"><button class="secondary" data-action="favourite" aria-pressed="${isFavourite(r)}">${isFavourite(r)?'★ Favourite':'☆ Mark as favourite'}</button>${!screen.snapshot?`<button class="secondary" data-action="tried">${status(r)==='Tried'?'Mark as not yet cooked':'Mark as tried'}</button>`:''}</div><h2 class="spaced">Ingredients</h2><div class="ingredients">${r.ingredients.map(i=>`<div class="ingredient-row"><span class="ingredient-quantity">${fmt(i.amount)} ${esc(i.unit||catalog[i.key]?.unit||'')}</span><span>${esc(i.name||catalog[i.key]?.name||i.key)}</span></div>`).join('')}</div><h2 class="spaced">Method</h2><ol class="steps">${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><h2 class="spaced">Your comment</h2><label><textarea id="recipe-comment" rows="4" placeholder="Add a note about this recipe…">${esc(commentEdit?.id===r.id?commentEdit.text:commentFor(r))}</textarea></label><button class="secondary" data-action="comment">Save comment</button>`:'<p>This saved recipe could not be found.</p>'}</section>`;
  }
  app.innerHTML=`<fieldset class="app-controls" ${busy?'disabled':''}>`+html+ (notice?`<p class="notice" role="status">${esc(notice)}</p>`:'') +(removedPlan?'<div class="content"><button class="secondary" data-action="undo-remove">Undo removal</button></div>':'')+nav()+`<section class="content cloud-controls"><p id="sync-status" class="sub" role="status">${busy?'Saving…':'Connected to your household'}</p><button class="secondary" data-action="lock">Lock planner</button>${incoming?'<button class="secondary" data-action="refresh-cloud">Load latest saves</button>':''}${legacy && (legacy.saved.length || legacy.draft?.ids.length || Object.keys(legacy.tried).length)?'<button class="secondary" data-action="import-local">Import this browser’s old saves</button>':''}<p class="image-credit">Images via <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a> and <a href="https://github.com/surhud004/Foodish" target="_blank" rel="noreferrer">Foodish</a></p></section></fieldset>`;
  if(!keepScroll)window.scrollTo(0,0);
}
function reuse(rows){return rows.filter(r=>r.meals.length>1).map(r=>`${r.name}: ${fmt(r.amount)} ${r.unit} across ${r.meals.join('; ')}`);}
function reuseHTML(rows){const lines=reuse(rows);return lines.length?`<ul class="reuse">${lines.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:'<p>No shared ingredients in this selection.</p>';}

app.addEventListener('error',e=>{if(e.target.matches?.('[data-remote-image]'))e.target.hidden=true;},true);
app.addEventListener('submit',async e=>{
  if(e.target.id!=='unlock-form')return;e.preventDefault();if(busy || !cloud)return;
  const password=document.querySelector('#password').value;
  busy=true;authError='';render(true);
  try{await cloud.login(password);}catch(e){authError=e.code==='auth/too-many-requests'?'Too many attempts. Please wait and try again.':e.code==='auth/network-request-failed'?'Could not connect. Check your internet connection.':'Could not unlock the planner. Check the household password.';}
  finally{busy=false;render(true);}
});
app.addEventListener('input',e=>{
  if(e.target.id==='feedback')feedbackEdit={id:screen.id,text:e.target.value};
  if(e.target.id==='recipe-comment')commentEdit={id:screen.id,text:e.target.value};
  if(e.target.id==='search'){filters.search=e.target.value;document.querySelector('#recipe-results').innerHTML=cards(screen.type==='plan');}
});
app.addEventListener('change',e=>{
  if(!e.target.dataset.filter && !e.target.dataset.pack && !['week-date','meal-count'].includes(e.target.id))return;
  return mutate(async()=>{
  const el=e.target;
  if(el.dataset.filter){filters[el.dataset.filter]=el.value;render(true);}
  if(el.id==='week-date'){if(el.value)draft.date=el.value;await saveDraft();render(true);}
  if(el.id==='meal-count'){
    const n=Number(el.value);
    if(!Number.isSafeInteger(n)||n<1){notice='Enter a positive whole number of dinners.';render(true);return;}
    draft.count=n;notice=n<draft.ids.length?'Remove dinners to match the new count. Your selections have been kept.':'';await saveDraft();render(true);
  }
  if(el.dataset.pack){const n=Number(el.value);if(n>0&&Number.isFinite(n)){draft.packs[el.dataset.pack]=n;await saveDraft();}render(true);}
});
});
app.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const a=b.dataset.action;
  if(a==='lock'){
    if(busy)return;
    try{await cloud.logout();feedbackEdit=null;commentEdit=null;incoming=null;removedPlan=null;notice='';records={};saved=[];draft=emptyDraft();tried={};comments={};favourites={};ready=false;render();}catch{notice='Could not lock the planner. Please try again.';render();}return;
  }
  if(a==='reload'){location.reload();return;}
  if(a==='refresh-cloud'){if(incoming){feedbackEdit=null;applyRecords(incoming);incoming=null;notice='Loaded the latest saves.';render();}return;}
  if(!ready || busy)return;
  // Navigation does not write data or discard an unsaved feedback field.
  return mutate(async()=>{
  if(b.dataset.nav){screen={type:b.dataset.nav};notice='';}
  else if(b.dataset.week)screen={type:'week',id:b.dataset.week};
  else if(b.dataset.recipe){returnScreen={...screen};screen={type:'recipe',id:b.dataset.recipe,snapshot:b.dataset.snapshot};}
  else if(b.dataset.favourite){const id=b.dataset.favourite;favourites={...favourites,[id]:!favourites[id]};if(await persist('dinner-favourites-v1',favourites))notice=favourites[id]?'Recipe added to favourites.':'Recipe removed from favourites.';}
  else if(b.dataset.toggle){const id=b.dataset.toggle;if(draft.ids.includes(id))draft.ids=draft.ids.filter(v=>v!==id);else if(draft.ids.length<draft.count)draft.ids.push(id);await saveDraft();render(true);return;}
  else if(b.dataset.swap){
    const id=b.dataset.swap, current=selected(), locked=current.filter(r=>r.id!==id);
    const replacement=suggest(recipes,draft.count,recentIds(),locked,[id]).find(r=>!locked.some(s=>s.id===r.id));
    if(replacement){draft.ids=draft.ids.map(v=>v===id?replacement.id:v);notice=`Swapped in ${replacement.title}.`;await saveDraft();}
    else notice='No different recipe is available to swap in.';
  }
  else if(a==='back')screen=screen.type==='recipe'?returnScreen:screen.type==='review'?{type:'plan'}:screen.type==='export'?{type:'week',id:screen.id}:{type:'weeks'};
  else if(a==='plan')screen={type:'plan'};
  else if(a==='suggest'){
    if(draft.count<draft.ids.length){notice='Remove dinners to match your chosen count first.';}
    else {draft.ids=suggest(recipes,draft.count,recentIds(),selected()).map(r=>r.id);notice=draft.ids.length<draft.count?'The library does not have enough different recipes for this count. Add recipes separately or choose fewer dinners.':'';await saveDraft();}
  }
  else if(a==='review'){if(!validate(draft.count,selected()))screen={type:'review'};}
  else if(a==='save'){
    const problem=validate(draft.count,selected());if(problem){notice=problem;render();return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)){notice='Choose a week date.';render();return;}
    if(weeks().some(w=>w.id===draft.date)){notice='A plan already exists for this date. Choose another date in the planner to keep both plans.';render();return;}
    const rows=totals(selected(),catalog,draft.packs);
    const w={id:draft.date,title:'Dinners from the recipe library',mealCount:draft.count,dinners:selected().map(r=>[r.id,r.title]),snapshots:JSON.parse(JSON.stringify(selected().map(r=>({...r,status:status(r),ingredients:r.ingredients.map(i=>({...i,name:catalog[i.key].name,unit:catalog[i.key].unit}))})))),shopping:shoppingSections(rows),reuse:reuse(rows),packSizes:{...draft.packs},feedback:''};
    const nextDraft={date:today(),count:w.mealCount,ids:[],packs:{}};
    const changes=[...changesFor('dinner-plans-v1',[...saved,w],records),...changesFor('dinner-draft-v1',nextDraft,records)];
    await cloud.save(changes);
    for(const change of changes)records[change.id]={payload:change.payload,revision:change.revision+1};
    saved.push(w);draft=nextDraft;screen={type:'week',id:w.id};notice='Week saved to your household.';
  }
  else if(a==='remove-local'){removedPlan=saved.find(w=>w.id===screen.id);saved=saved.filter(w=>w.id!==screen.id);await persist('dinner-plans-v1',saved);screen={type:'weeks'};notice='Saved week removed from your household.';}
  else if(a==='undo-remove'){if(removedPlan){saved.push(removedPlan);await persist('dinner-plans-v1',saved);removedPlan=null;notice='Saved week restored.';}}
  else if(a==='tried'){const r=recipes.find(r=>r.id===screen.id);tried[r.id]=status(r)!=='Tried';if(await persist('dinner-tried-v1',tried))notice='Cooking status saved to your household.';}
  else if(a==='favourite'){const r=recipes.find(r=>r.id===screen.id);if(r){favourites={...favourites,[r.id]:!isFavourite(r)};if(await persist('dinner-favourites-v1',favourites))notice=favourites[r.id]?'Recipe added to favourites.':'Recipe removed from favourites.';}}
  else if(a==='comment'){
    const r=recipes.find(r=>r.id===screen.id), text=commentEdit?.id===screen.id?commentEdit.text:document.querySelector('#recipe-comment')?.value||'';
    if(r){comments={...comments,[r.id]:text};if(await persist('dinner-comments-v1',comments))notice=text?'Recipe comment saved to your household.':'Recipe comment cleared.';commentEdit=null;}
  }
  else if(a==='feedback'){
    const w=JSON.parse(JSON.stringify(weeks().find(w=>w.id===screen.id)));w.feedback=feedbackEdit?.id===w.id?feedbackEdit.text:document.querySelector('#feedback').value;saved=saved.filter(s=>s.id!==w.id).concat(w);if(await persist('dinner-plans-v1',saved))notice='Feedback saved to your household.';feedbackEdit=null;
  }
  else if(a==='import-local'){
    // Import only absent records, including respecting cloud deletion tombstones.
    const additions=legacy.saved.filter(w=>/^\d{4}-\d{2}-\d{2}$/.test(w.id)&&!records[`week-${w.id}`]);
    const changes=changesFor('dinner-plans-v1',[...saved,...additions],records);
    if(legacy.draft && !records.draft)changes.push(...changesFor('dinner-draft-v1',legacy.draft,records));
    const importedTried=Object.fromEntries(Object.entries(legacy.tried).filter(([id])=>!records[`tried-${id}`]));
    changes.push(...changesFor('dinner-tried-v1',importedTried,records));
    await cloud.save(changes);
    for(const change of changes)records[change.id]={payload:change.payload,revision:change.revision+1};
    applyRecords(records);
    notice=`Imported ${additions.length} weeks. Existing cloud saves were kept; original browser copies remain on this device.`;
    legacy=null;
  }
  else if(a==='export'||a==='markdown'){
    screen={type:'export',id:screen.id,format:a==='export'?'json':'md'};
  }
  else if(a==='select-export'){document.querySelector('#export-text').select();return;}
  else return;
  render();
  });
});
app.innerHTML=header('Dinner, sorted','Loading the recipe library…');
async function start(){
  try{
    const [loaded, localPassword]=await Promise.all([Promise.all(['./data/recipes.json','./data/ingredients.json','./firebase-config.json'].map(async url=>{
      const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('Could not load the planner. Please reload.');return response.json();
    })),loadDevAuthPassword()]);
    [recipes,catalog,config]=loaded;
    recipePhotos=assignRecipePhotos(recipes);
    devAuthPassword=localPassword;
    if(!config.firebase?.apiKey || !config.firebase?.authDomain || !config.firebase?.projectId || !config.firebase?.appId || !config.householdUid || !config.householdEmail){render();return;}
    cloud=await connectCloud(config,authenticated=>{
      signedIn=authenticated;ready=false;
      if(!authenticated){saved=[];tried={};comments={};favourites={};draft=emptyDraft();records={};incoming=null;feedbackEdit=null;commentEdit=null;screen={type:'weeks'};}
      render(true);
    },receiveRecords,e=>{error=saveMessage(e);ready=false;render(true);});
    render(true);
    if(devAuthPassword && !signedIn){
      busy=true;authError='';render(true);
      try{await cloud.login(devAuthPassword);}catch(e){authError=e.code==='auth/too-many-requests'?'Too many attempts. Please wait and try again.':e.code==='auth/network-request-failed'?'Could not connect. Check your internet connection.':'Could not auto-unlock the planner. Check COOKING_HOUSEHOLD_PASSWORD in .env.local.';}
      finally{busy=false;render(true);}
    }
  }catch(e){app.innerHTML=header('Could not connect',e.message)+'<section class="content"><button onclick="location.reload()">Retry</button></section>';}
}
window.addEventListener('beforeunload',e=>{if(busy||feedbackEdit||commentEdit){e.preventDefault();e.returnValue='';}});
start();
