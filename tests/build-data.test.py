"""Exercise the recipe-data build contract without publishing repository weeks."""
import json,pathlib,shutil,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parent.parent

class BuildTest(unittest.TestCase):
    def test_builds_recipes_and_ignores_week_exports(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            for folder in ['recipes','data','scripts']:
                shutil.copytree(ROOT/folder,root/folder)
            weeks=root/'weeks'
            weeks.mkdir()
            (weeks/'2026-09-21.json').write_text(json.dumps({'id':'2026-09-21'}))

            subprocess.run(['python3',str(root/'scripts/build-data.py')],check=True,capture_output=True)
            recipes=json.loads((root/'data/recipes.json').read_text())
            self.assertGreater(len(recipes),0)
            self.assertFalse((root/'data/weeks.json').exists())

            before=(root/'data/recipes.json').read_bytes()
            subprocess.run(['python3',str(root/'scripts/build-data.py')],check=True,capture_output=True)
            self.assertEqual(before,(root/'data/recipes.json').read_bytes())

if __name__=='__main__':
    unittest.main()
