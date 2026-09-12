#!/usr/bin/env python3
"""Build static recipe data from repository cards. Run after editing content."""
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
print(f'Built {len(recipes)} recipes')
