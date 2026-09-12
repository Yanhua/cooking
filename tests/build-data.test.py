"""Exercise the export/import contract in an isolated copy of the library."""
import json,pathlib,shutil,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parent.parent
class ImportTest(unittest.TestCase):
    def test_import_generates_documents_and_preserves_snapshots(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            for folder in ['recipes','data','weeks','scripts']:
                shutil.copytree(ROOT/folder,root/folder)
            (root/'shopping-lists').mkdir()
            old=json.loads((root/'weeks/2026-09-14.json').read_text())
            plan={**old,'id':'2026-09-21','mealCount':1,'dinners':old['dinners'][:1], 'snapshots':old['snapshots'][:1], 'feedback':'Good portions'}
            (root/'weeks/2026-09-21.json').write_text(json.dumps(plan))
            recipe=root/plan['snapshots'][0]['path']
            recipe.write_text(recipe.read_text().replace('300 g pork mince','300 g pork mince, finely crumbled'))
            subprocess.run(['python3',str(root/'scripts/build-data.py')],check=True,capture_output=True)
            plans=json.loads((root/'data/weeks.json').read_text())
            imported=next(w for w in plans if w['id']=='2026-09-21')
            self.assertEqual(imported['snapshots'],plan['snapshots'])
            self.assertEqual(imported['shopping'],plan['shopping'])
            md=(root/'weeks/2026-09-21.md').read_text()
            self.assertIn('1 dinners',md)
            self.assertIn('Good portions',md)
            self.assertTrue((root/'shopping-lists/2026-09-21.md').exists())
            before=(root/'data/weeks.json').read_bytes()
            subprocess.run(['python3',str(root/'scripts/build-data.py')],check=True,capture_output=True)
            self.assertEqual(before,(root/'data/weeks.json').read_bytes())
if __name__=='__main__':unittest.main()
