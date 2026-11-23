// ALOPEX WEB CONCIERGE V2 - nonproduction Cloudflare Worker prototype.
// Required bindings: DB (D1), RESEND_API_KEY, EMAIL_FROM, GAS_URL, GAS_SECRET.
// No client-specific access registry; only opaque, expiring resume tokens.
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const emailOK=x=>typeof x==='string'&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
const noCache={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const allowOrigin=(req,env)=>{const o=req.headers.get('Origin');return !o||o===env.PUBLIC_ORIGIN};
async function body(req){if(Number(req.headers.get('content-length')||0)>180000)throw Error('too_large');const t=await req.text();if(t.length>180000)throw Error('too_large');return JSON.parse(t);}
async function sendMail(env,to,subject,html){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,html})});if(!r.ok)throw Error('email_failed');}
function validAnswers(a){return a&&typeof a==='object'&&!Array.isArray(a)&&JSON.stringify(a).length<=150000;}
async function authorized(req,env){const t=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!t||!/^[a-f0-9]{64}$/.test(t))return null;return env.DB.prepare('SELECT * FROM drafts WHERE resume_hash=? AND expires_at>? AND submitted_at IS NULL').bind(await hash(t),Date.now()).first();}
export default {async fetch(req,env){const u=new URL(req.url);if(!u.pathname.startsWith('/api/v2/'))return new Response('Not found',{status:404});if(!allowOrigin(req,env))return json({error:'origin_denied'},403,noCache);if(!['POST','GET'].includes(req.method))return json({error:'method'},405,noCache);
try{
 if(u.pathname==='/api/v2/start'&&req.method==='POST'){
  const d=await body(req);if(!emailOK(d.email)||!d.company?.trim()||!d.contact?.trim()||d.company.length>180||d.contact.length>180)return json({error:'invalid_contact'},400,noCache);
  const id=crypto.randomUUID(),secret=token(),expiry=Date.now()+30*86400000;
  await env.DB.prepare('INSERT INTO drafts(id,email,company,contact,answers,resume_hash,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,d.email.trim().toLowerCase(),d.company.trim(),d.contact.trim(),JSON.stringify({}),await hash(secret),expiry,Date.now()).run();
  const link=env.PUBLIC_ORIGIN+'/hearing-v2/?resume='+encodeURIComponent(secret);
  try{await sendMail(env,d.email.trim(),'ALOPEX ヒアリング再開リンク','<p>回答を再開するには次のリンクを開いてください（30日間有効）。</p><p><a href="'+link+'">回答を再開する</a></p>');}
  catch(e){await env.DB.prepare('DELETE FROM drafts WHERE id=?').bind(id).run();throw e;}
  return json({ok:true,message:'再開用リンクをメール送信しました。'},200,noCache);
 }
 if(u.pathname==='/api/v2/draft'&&req.method==='GET'){
  const row=await authorized(req,env);if(!row)return json({error:'invalid_or_expired'},401,noCache);
  return json({id:row.id,company:row.company,contact:row.contact,answers:JSON.parse(row.answers),expiresAt:row.expires_at},200,noCache);
 }
 if(u.pathname==='/api/v2/draft'&&req.method==='POST'){
  const row=await authorized(req,env);if(!row)return json({error:'invalid_or_expired'},401,noCache);
  const d=await body(req);if(!validAnswers(d.answers))return json({error:'invalid_answers'},400,noCache);
  await env.DB.prepare('UPDATE drafts SET answers=?,updated_at=? WHERE id=? AND submitted_at IS NULL').bind(JSON.stringify(d.answers),Date.now(),row.id).run();
  return json({ok:true},200,noCache);
 }
 if(u.pathname==='/api/v2/submit'&&req.method==='POST'){
  const row=await authorized(req,env);if(!row)return json({error:'invalid_or_expired'},401,noCache);
  const d=await body(req);if(!validAnswers(d.answers))return json({error:'invalid_answers'},400,noCache);
  // Do not mark submitted before durable Sheets receipt. GAS endpoint must be idempotent by submissionId.
  const payload={submissionId:row.id,company:row.company,contact:row.contact,email:row.email,answers:d.answers};
  const r=await fetch(env.GAS_URL,{method:'POST',headers:{'content-type':'application/json','x-alopex-secret':env.GAS_SECRET},body:JSON.stringify(payload)});
  if(!r.ok)throw Error('sheets_unavailable');
  const receipt=await r.json();if(receipt.ok!==true||receipt.submissionId!==row.id)throw Error('sheets_unverified');
  await env.DB.prepare('UPDATE drafts SET answers=?,submitted_at=?,updated_at=? WHERE id=? AND submitted_at IS NULL').bind(JSON.stringify(d.answers),Date.now(),Date.now(),row.id).run();
  return json({ok:true,submissionId:row.id},200,noCache);
 }
 return json({error:'not_found'},404,noCache);
}catch(e){return json({error:['too_large','email_failed','sheets_unavailable','sheets_unverified'].includes(e.message)?e.message:'request_failed'},e.message==='too_large'?413:503,noCache);}
}};
