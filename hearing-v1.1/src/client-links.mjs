const LINK_COOKIE='__Host-alopex-client';
export async function hashToken(token){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function linkRegistry(env){
 const r=JSON.parse(env.CLIENT_LINKS||'{"version":1,"links":[]}');
 if(r.version!==1||!Array.isArray(r.links)||r.links.length>2000)throw Error('link_configuration');
 const seen=new Set();for(const l of r.links){if(!l||!/^[a-f0-9]{64}$/.test(l.tokenHash)||!/^[-a-zA-Z0-9]{3,80}$/.test(l.projectId)||typeof l.enabled!=='boolean'||!Number.isFinite(Date.parse(l.expiresAt))||seen.has(l.tokenHash))throw Error('link_configuration');seen.add(l.tokenHash)}return r.links;
}
async function signature(value,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function timingEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
export async function exchangeLink(token,env,now=Date.now()){
 if(env.CLIENT_LINKS_ENABLED!=='true'||!env.ACCESS_COOKIE_SECRET||env.ACCESS_COOKIE_SECRET.length<32)return {status:503,error:'link_configuration'};
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return {status:403,error:'link_invalid'};
 let links;try{links=linkRegistry(env)}catch{return {status:503,error:'link_configuration'}}
 const hash=await hashToken(token),l=links.find(l=>timingEqual(l.tokenHash,hash)&&l.enabled&&Date.parse(l.expiresAt)>now);
 if(!l)return {status:403,error:'link_invalid'};
 const expires=Math.min(Math.floor(Date.parse(l.expiresAt)/1000),Math.floor(now/1000)+86400),value='v1.'+hash+'.'+expires;
 const cookie=value+'.'+await signature(value,env.ACCESS_COOKIE_SECRET);
 return {projectId:l.projectId,expiresAt:l.expiresAt,cookie:LINK_COOKIE+'='+cookie+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.max(0,expires-Math.floor(now/1000))};
}
export async function clientPrincipal(request,env,projectId,now=Date.now()){
 if(env.DEPLOYMENT_MODE!=='token_clients')return principal(request,env,projectId,now);
 const uid=request.headers.get('oai-authenticated-user-id');
 if(uid&&(env.OPERATOR_IDS||'').split(',').includes(uid)&&(!projectId||projectId==='QA-V11-OWNER')&&!request.headers.get('Cookie')?.includes(LINK_COOKIE+'='))return {userId:uid,role:'operator',projectId:'QA-V11-OWNER',projects:['QA-V11-OWNER'],expiresAt:null,review:true};
 if(env.CLIENT_LINKS_ENABLED!=='true'||env.CLIENT_RELEASE_APPROVED!=='true'||!env.ACCESS_COOKIE_SECRET||env.ACCESS_COOKIE_SECRET.length<32)return {status:503,error:'link_configuration'};
 const raw=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(LINK_COOKIE+'='))?.slice(LINK_COOKIE.length+1);
 if(!raw||!/^v1\.[a-f0-9]{64}\.[0-9]{10}\.[a-f0-9]{64}$/.test(raw))return {status:401,error:'client_link_required'};
 const [v,hash,exp,sig]=raw.split('.');if(Number(exp)*1000<=now||!timingEqual(sig,await signature(v+'.'+hash+'.'+exp,env.ACCESS_COOKIE_SECRET)))return {status:403,error:'link_invalid'};
 let links;try{links=linkRegistry(env)}catch{return {status:503,error:'link_configuration'}}
 const l=links.find(l=>timingEqual(l.tokenHash,hash)&&l.enabled&&Date.parse(l.expiresAt)>now);
 if(!l||projectId&&l.projectId!==projectId)return {status:403,error:'project_forbidden'};
 return {userId:'link-'+hash.slice(0,24),role:'client',projectId:l.projectId,projects:[l.projectId],expiresAt:l.expiresAt,review:false};
}
