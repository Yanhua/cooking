#!/usr/bin/env python3
"""Build static recipe/week data from repository cards. Run after editing content."""
import hashlib,json,pathlib,re
root=pathlib.Path(__file__).resolve().parent.parent
catalog=json.loads((root/'data/ingredients.json').read_text())
recipes=[]
for path in sorted(root.glob('recipes/*/*.md')):
    md=path.read_text()
    match=re.search(r'<!-- recipe-data\n(.*?)\n-->',md,re.S)
    if not match: raise ValueError(f'Missing recipe metadata: {path}')
    r=json.loads(match[1]);r.update(title=md.splitlines()[0][2:],path=str(path.relative_to(root)),version=hashlib.sha256(md.encode()).hexdigest()[:12],group=path.parent.name)
    r['steps']=re.findall(r'^\d+\. (.+)$',md.split('## Method')[1],re.M)
    assert r['servings']==2 and 0 < r['activeMinutes'] <= 30, path
    for i in r['ingredients']:
        assert i['key'] in catalog and i['amount']>0, (path,i)
    recipes.append(r)
assert len({r['id'] for r in recipes})==len(recipes)
(root/'data/recipes.json').write_text(json.dumps(recipes,indent=2)+'\n')
# Imported JSON plans are snapshots exported by the browser.
weeks=[]
for path in sorted(root.glob('weeks/*.json')):
    w=json.loads(path.read_text())
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}',w['id']) and path.stem==w['id'],path
    assert w['mealCount']==len(w['snapshots'])==len(w['dinners']) and w['mealCount']>0,path
    assert [r['id'] for r in w['snapshots']]==[d[0] for d in w['dinners']],path
    weeks.append(w)
    shopping='\n\n'.join('### '+g['category']+'\n\n'+'\n'.join('- '+i for i in g['items']) for g in w['shopping'])
    dinners='\n'.join(f"{n+1}. [{r['title']}](../{r['path']}) — {r['cuisine']}; {r['activeMinutes']} min active; version {r['version']}" for n,r in enumerate(w['snapshots']))
    feedback=w.get('feedback') or '| Dinner | Rating / notes | Repeat? |\n|---|---|---|\n'+'\n'.join('| '+r['title']+' | | |' for r in w['snapshots'])
    markdown=f"# Dinner plan — {w['id']}\n\n{w['mealCount']} dinners · 2 people\n\n## Dinners\n\n"+dinners+'\n\n## Ingredient-reuse map\n\n'+'\n'.join('- '+s for s in w['reuse'])+'\n\n## Shopping list\n\n'+shopping+'\n\n## Post-cooking notes\n\n'+feedback+'\n'
    # Preserve handwritten notes on the original plan; generate new imports from snapshots.
    if w['id']!='2026-09-14':
        path.with_suffix('.md').write_text(markdown)
        (root/'shopping-lists'/f"{w['id']}.md").write_text(f"# Shopping list — {w['id']}\n\n"+shopping+'\n')
(root/'data/weeks.json').write_text(json.dumps(weeks,indent=2)+'\n')
print(f'Built {len(recipes)} recipes and {len(weeks)} weeks')
