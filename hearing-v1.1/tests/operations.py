import sys,json,tempfile,subprocess,unittest,base64
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'ops'))
from normalize import normalize,HEADERS
from backup import encrypt,decrypt
class Operations(unittest.TestCase):
 def sample(self):return [HEADERS,['receipt-one','PROJECT-A','S01Q01','会社・店舗名','"Private Name"','private note','2026-11-13T00:00:00Z','1.0.0'],['receipt-one','PROJECT-B','S01Q01','会社・店舗名','"Other Name"','','2026-11-13T00:00:00Z','1.0.0']]
 def test_projects_not_merged(self):self.assertEqual(len(normalize(self.sample())['submissions']),2)
 def test_free_text_and_notes_redacted(self):
  s=json.dumps(normalize(self.sample()));self.assertNotIn('Private Name',s);self.assertNotIn('private note',s)
 def test_sensitive_export_explicit(self):self.assertIn('Private Name',json.dumps(normalize(self.sample(),True)))
 def test_duplicate_rows_rejected(self):
  x=self.sample();x.append(x[1]);self.assertRaises(ValueError,normalize,x)
 def test_schema_mismatch_rejected(self):
  x=self.sample();x[1][-1]='2.0';self.assertRaises(ValueError,normalize,x)
 def test_backup_restore_roundtrip(self):
  x=self.sample();self.assertEqual(decrypt(encrypt(x,'test-only-long-passphrase-0001'),'test-only-long-passphrase-0001'),x)
 def test_wrong_key_rejected(self):
  e=encrypt(self.sample(),'test-only-long-passphrase-0001');self.assertRaises(Exception,decrypt,e,'test-only-long-passphrase-0002')
 def test_tampered_backup_rejected(self):
  e=encrypt(self.sample(),'test-only-long-passphrase-0001');b=bytearray(base64.b64decode(e['ciphertext']));b[-1]^=1;e['ciphertext']=base64.b64encode(b).decode();self.assertRaises(Exception,decrypt,e,'test-only-long-passphrase-0001')
 def test_access_grant_revoke_cli(self):
  root=Path(__file__).parents[1]
  with tempfile.TemporaryDirectory() as d:
   p=str(Path(d)/'registry.json')
   subprocess.run(['node','ops/access.mjs','grant',p,'test-user','PROJECT-TEST','2099-01-01T00:00:00Z'],cwd=root,check=True,capture_output=True)
   self.assertTrue(json.loads(Path(p).read_text())['grants'][0]['enabled'])
   subprocess.run(['node','ops/access.mjs','revoke',p,'test-user','PROJECT-TEST'],cwd=root,check=True,capture_output=True)
   r=json.loads(Path(p).read_text());self.assertFalse(r['grants'][0]['enabled']);self.assertEqual(len(r['history']),2)
 def test_deletion_plan_exact_project_and_receipt(self):
  root=Path(__file__).parents[1]
  with tempfile.TemporaryDirectory() as d:
   src=Path(d)/'input.json';out=Path(d)/'plan.json';src.write_text(json.dumps(self.sample()))
   subprocess.run([sys.executable,'ops/deletion-plan.py',str(src),str(out),'--project','PROJECT-A','--receipt','receipt-one'],cwd=root,check=True,capture_output=True)
   plan=json.loads(out.read_text());self.assertEqual(plan['rowNumbersDescending'],[2]);self.assertFalse(plan['liveGoogleChanged']);self.assertEqual(json.loads(src.read_text()),self.sample())
 def test_deletion_plan_unknown_target_fails_closed(self):
  root=Path(__file__).parents[1]
  with tempfile.TemporaryDirectory() as d:
   src=Path(d)/'input.json';out=Path(d)/'plan.json';src.write_text(json.dumps(self.sample()))
   result=subprocess.run([sys.executable,'ops/deletion-plan.py',str(src),str(out),'--project','UNKNOWN','--receipt','receipt-one'],cwd=root,capture_output=True)
   self.assertNotEqual(result.returncode,0);self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
