import fs from 'node:fs';import crypto from 'node:crypto';import {registry} from '../src/access.mjs';
const [command,path,...args]=process.argv.slice(2);
if(!['validate','grant','revoke'].includes(command)||!path)throw Error('Usage: node ops/access.mjs validate|grant|revoke registry.json [userId projectId expiresAt]');
const r=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{version:1,grants:[],history:[]};registry({ACCESS_REGISTRY:JSON.stringify(r)});
if(command!=='validate'){
 const [userId,projectId,expiresAt]=args;let g=r.grants.find(g=>g.userId===userId&&g.projectId===projectId);
 if(command==='grant'){if(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())throw Error('Future expiry required');if(!g){g={userId,projectId};r.grants.push(g)}Object.assign(g,{enabled:true,expiresAt});}
 else{if(!g)throw Error('Unknown grant; no change');g.enabled=false;}
 registry({ACCESS_REGISTRY:JSON.stringify(r)});
 const hash=crypto.createHash('sha256').update(JSON.stringify(r.grants)).digest('hex');
 r.history??=[];r.history.push({at:new Date().toISOString(),action:command,userId,projectId,grantsHash:hash});
 const tmp=path+'.tmp';fs.writeFileSync(tmp,JSON.stringify(r,null,2),{mode:0o600,flag:'wx'});fs.renameSync(tmp,path);
}
console.log(JSON.stringify({valid:true,grants:r.grants.length,active:r.grants.filter(g=>g.enabled&&Date.parse(g.expiresAt)>Date.now()).length,changed:command!=='validate',appliedToSite:false}));
