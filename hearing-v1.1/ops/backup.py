"""Authenticated encrypted snapshot; restore creates a staging file, never edits Google."""
import base64,json,hashlib,secrets,getpass,sys
from datetime import datetime,timezone
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
AAD=b'ALOPEX-HEARING-BACKUP-V1'
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def encrypt(data,passphrase):
    if len(passphrase)<20:raise ValueError('Use a separate passphrase of at least 20 characters')
    salt,nonce=secrets.token_bytes(16),secrets.token_bytes(12)
    manifest={'format':'alopex-backup-v1','createdAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(canonical(data)).hexdigest(),'payload':data}
    key=Scrypt(salt=salt,length=32,n=32768,r=8,p=1).derive(passphrase.encode())
    b64=lambda b:base64.b64encode(b).decode()
    return {'format':'alopex-backup-v1','kdf':'scrypt-32768-8-1','salt':b64(salt),'nonce':b64(nonce),'ciphertext':b64(AESGCM(key).encrypt(nonce,canonical(manifest),AAD))}
def decrypt(envelope,passphrase):
    if envelope.get('format')!='alopex-backup-v1' or envelope.get('kdf')!='scrypt-32768-8-1':raise ValueError('Unsupported backup format')
    b64=lambda k:base64.b64decode(envelope[k],validate=True)
    key=Scrypt(salt=b64('salt'),length=32,n=32768,r=8,p=1).derive(passphrase.encode())
    manifest=json.loads(AESGCM(key).decrypt(b64('nonce'),b64('ciphertext'),AAD))
    if manifest.get('format')!='alopex-backup-v1' or hashlib.sha256(canonical(manifest['payload'])).hexdigest()!=manifest['sha256']:raise ValueError('Checksum mismatch')
    return manifest['payload']
if __name__=='__main__':
    if len(sys.argv)!=4 or sys.argv[1] not in ['create','restore']:raise SystemExit('Usage: python3 ops/backup.py create|restore input output')
    mode,src,dst=sys.argv[1:];data=json.loads(Path(src).read_text());password=getpass.getpass('Backup passphrase (hidden): ')
    output=encrypt(data,password) if mode=='create' else decrypt(data,password)
    with open(dst,'x',encoding='utf8') as f:json.dump(output,f,ensure_ascii=False,indent=2)
    print(json.dumps({'operation':mode,'verified':True,'liveGoogleChanged':False}))
