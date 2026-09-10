let recipes = [];
let recipeLoadError = '';

function repository() {
  const [owner] = location.hostname.split('.');
  const [repo] = location.pathname.split('/').filter(Boolean);
  return { owner, repo };
}

function markdownSection(markdown, heading, marker) {
  const match = markdown.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return match ? match[1].split('\\n').map(line => line.replace(marker, '').trim()).filter(Boolean) : [];
}

function splitIngredient(ingredient) {
  // Keep the amount together with common recipe units, while leaving the rest
  // of the line as the ingredient description.
  const match = ingredient.match(/^(\d+(?:[./]\d+)?(?:\s+\d+\/\d+)?(?:[–-]\d+(?:[./]\d+)?(?:\s+\d+\/\d+)?)?(?:\s+(?:g|kg|ml|l|tbsp|tsp|cups?|cans?))?)\s+(.+)$/i);
  return match ? { quantity: match[1], name: match[2] } : { quantity: '—', name: ingredient };
}

function parseRecipe(markdown, path) {
  const title = markdown.match(/^# (.+)$/m)?.[1];
  if (!title) throw new Error(`Missing title in ${path}`);
  const serves = markdown.match(/^\*\*Serves:\*\*\s*(.+)$/m)?.[1] || '';
  const activeTime = markdown.match(/^\*\*Active time:\*\*\s*(.+)$/m)?.[1] || '';
  const pressureTime = markdown.match(/\*\*pressure time:\*\*\s*(.+)$/mi)?.[1];
  const category = path.split('/')[1] || 'recipes';
  return {
    id: path.split('/').pop().replace(/\.md$/, ''),
    title,
    cuisine: category[0].toUpperCase() + category.slice(1),
    icon: category === 'asian' ? '🥢' : '🍽️',
    serves,
    time: [activeTime, pressureTime].filter(Boolean).join(' · '),
    ingredients: markdownSection(markdown, 'Ingredients', /^-\s+/).map(splitIngredient),
    steps: markdownSection(markdown, 'Method', /^\d+\.\s+/)
  };
}

async function loadRecipes() {
  const { owner, repo } = repository();
  if (!owner || !repo || !location.hostname.endsWith('.github.io')) {
    throw new Error('Recipes are available when viewing the published GitHub Pages site.');
  }
  const repositoryResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!repositoryResponse.ok) throw new Error('Could not find the recipe repository.');
  const { default_branch: branch } = await repositoryResponse.json();
  const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  if (!treeResponse.ok) throw new Error('Could not load the recipe folder.');
  const { tree } = await treeResponse.json();
  const paths = tree.filter(item => item.type === 'blob' && /^recipes\/.+\.md$/i.test(item.path)).map(item => item.path).sort();
  recipes = await Promise.all(paths.map(async path => {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
    if (!response.ok) throw new Error(`Could not load ${path}.`);
    return parseRecipe(await response.text(), path);
  }));
}

const weeks = [{ id:'2026-09-14', date:'Week of 14 September 2026', title:'Four dinners, nicely shared', dinners:[['lu-rou-fan','Pressure-cooker Taiwanese lu rou fan with bok choy and egg'],['mexican-pork-corn-skillet','Mexican pork, corn and zucchini rice skillet'],['vietnamese-caramel-chicken','Vietnamese caramel chicken with green beans and rice'],['italian-chicken-mushroom-zucchini-pasta','Italian chicken, mushroom and zucchini pasta']], reuse:['500 g pork-mince pack: 300 g for lu rou fan; 200 g for the Mexican skillet.','700 g chicken-thigh pack: 350 g for Vietnamese caramel chicken; 350 g for Italian pasta.','250 g mushrooms: 125 g in lu rou fan; 125 g in Italian pasta.','2 zucchini: one in the Mexican skillet; one in Italian pasta.','Rice: cooked in the rice cooker for lu rou fan, the Mexican skillet, and Vietnamese chicken.','Garlic bulb: shared across all four dinners; cooked onion is used in the Taiwanese and Mexican dishes.'] }];

const app = document.querySelector('#app');
let screen = { type:'weeks' };
const esc = value => value.replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const nav = active => `<nav class="bottom-nav" aria-label="Main navigation"><button class="nav-button ${active === 'weeks' ? 'active' : ''}" data-nav="weeks">▣&nbsp; Weeks</button><button class="nav-button ${active === 'recipes' ? 'active' : ''}" data-nav="recipes">✦&nbsp; Recipes</button></nav>`;
const pageHeader = (eyebrow, title, sub='') => `<header class="top"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</header>`;

function render() {
  if (screen.type === 'weeks') {
    app.innerHTML = pageHeader('Home kitchen', 'Dinner, sorted', 'Simple plans and tried-and-true recipes.') + `<section class="content"><div class="section-title"><h2>Weekly plans</h2><span class="count">${weeks.length} plan</span></div>${weeks.map(w => `<button class="card week-card" data-week="${w.id}"><span class="date">${w.date}</span><h3>${w.title}</h3><p>${w.dinners.length} fresh dinners · all in 30 minutes or less</p><div class="mini-list">${w.dinners.map(([, name]) => `<span class="pill">${esc(name.split(' ').slice(0,2).join(' '))}</span>`).join('')}</div></button>`).join('')}</section>` + nav('weeks');
  } else if (screen.type === 'recipes') {
    const body = recipeLoadError ? `<p>${esc(recipeLoadError)}</p>` : recipes.length ? recipes.map(r => `<button class="card recipe-card" data-recipe="${r.id}"><span class="icon">${r.icon}</span><span><h3>${r.title}</h3><span class="recipe-meta">${r.cuisine} · ${r.time}</span></span></button>`).join('') : '<p>Loading recipes…</p>';
    app.innerHTML = pageHeader('Recipe book', 'What’s cooking?', 'Quick dinners from the recipe library.') + `<section class="content"><div class="section-title"><h2>All recipes</h2><span class="count">${recipes.length} recipes</span></div>${body}</section>` + nav('recipes');
  } else if (screen.type === 'recipe') {
    const r = recipes.find(recipe => recipe.id === screen.id);
    app.innerHTML = `<section class="content">${back()}<p class="eyebrow" style="margin-top:22px">${r.cuisine}</p><h1 class="detail-title">${r.title}</h1><div class="detail-meta"><span>Serves ${r.serves}</span><span>${r.time}</span></div><section class="detail-section"><h2>Ingredients</h2><div class="ingredients" role="list"><div class="ingredient-head" aria-hidden="true"><span>Quantity</span><span>Ingredient</span></div>${r.ingredients.map(({ quantity, name }) => `<div class="ingredient-row" role="listitem"><span class="ingredient-quantity">${esc(quantity)}</span><span class="ingredient-name">${esc(name)}</span></div>`).join('')}</div></section><section class="detail-section"><h2>Method</h2><ol class="steps">${r.steps.map(s => `<li>${s}</li>`).join('')}</ol></section></section>`;
  } else {
    const w = weeks.find(week => week.id === screen.id);
    app.innerHTML = `<section class="content">${back()}<p class="eyebrow" style="margin-top:22px">${w.date}</p><h1 class="detail-title">${w.title}</h1><div class="detail-meta"><span>${w.dinners.length} dinners</span><span>2 people</span><span>≤ 30 min active</span></div><section class="detail-section"><h2>This week</h2>${w.dinners.map(([id, name], n) => { const r = recipes.find(recipe => recipe.id === id); return `<article class="dinner-row"><span class="date">Dinner ${n + 1} · ${r.cuisine} · ${r.time}</span><h3>${name}</h3><button data-recipe="${id}">Open recipe →</button></article>`; }).join('')}</section><section class="detail-section"><h2>Ingredient reuse</h2><ul class="reuse">${w.reuse.map(i => `<li>${i}</li>`).join('')}</ul></section></section>`;
  }
  window.scrollTo({top:0, behavior:'instant'});
}
function back() { return `<button class="back" data-back="true">← Back</button>`; }
app.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.nav) screen = { type:button.dataset.nav };
  else if (button.dataset.recipe) screen = { type:'recipe', id:button.dataset.recipe };
  else if (button.dataset.week) screen = { type:'week', id:button.dataset.week };
  else if (button.dataset.back) screen = { type: screen.type === 'recipe' ? 'recipes' : 'weeks' };
  else return;
  render();
});
loadRecipes().catch(error => { recipeLoadError = error.message; }).finally(render);
