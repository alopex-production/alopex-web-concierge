import schema from '../hearing-v1.1/dist/schema.json' with {type:'json'};
import {emailOK, problem, visible} from './public/hearing-v2/core.mjs';

const headers = {
  'cache-control':'no-store', 'referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff', 'x-robots-tag':'noindex, nofollow',
  'content-security-policy':"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
};
const json = (data, status=200) => Response.json(data,{status,headers});
const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest = async (key,value) => {
  const encoder = new TextEncoder();
  const hmac = await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',hmac,encoder.encode(value))));
};
const forms = new Map(schema.questions.map(q=>[q.id,q]));
const routes = new Map([['/api/v2/start',['POST']],['/api/v2/draft',['GET','POST']],['/api/v2/submit',['POST']]]);
const contact = value => typeof value==='string' && value.trim().length>0 && value.trim().length<=180;
const day = 86400000;

async function parse(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder('utf-8',{fatal:true});
  let bytes = 0;
  let raw = '';
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes>800000) { await reader.cancel(); return null; }
      raw += decoder.decode(value,{stream:true});
    }
    const body = JSON.parse(raw+decoder.decode());
    return body && typeof body==='object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
async function rate(env, key, limit, span) {
  const end = (Math.floor(Date.now()/span)+1)*span;
  const bucket = await digest(env.HASH_KEY,key+':'+end);
  const row = await env.DB.prepare('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(bucket,end).first();
  return row.hits <= limit;
}
async function start(env, request, data) {
  if (!contact(data.company) || !contact(data.contact) || !emailOK(data.email?.trim?.())) return json({error:'invalid_contact'},400);
  const email = data.email.trim();
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (!await rate(env,'ip:'+ip,12,3600000) || !await rate(env,'email:'+email.toLowerCase(),3,day)) return json({error:'rate_limit'},429);
  const id = crypto.randomUUID();
  const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
  const company = data.company.trim();
  const name = data.contact.trim();
  const answers = JSON.stringify({S01Q01:company,S01Q02:name,S01Q03:email});
  await env.DB.prepare('INSERT INTO drafts (id,email,company,contact,answers,resume_hash,expires_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id,email,company,name,answers,await digest(env.HASH_KEY,secret),Date.now()+30*day).run();
  const link = new URL('/hearing-v2/#resume='+secret,env.PUBLIC_ORIGIN).href;
  const reply = await fetch('https://api.resend.com/emails',{
    method:'POST', signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':id},
    body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:'ALOPEX WEB制作ヒアリング｜再開リンク',
      text:'以下のリンクから回答を開始・再開できます（30日間有効）。ご自身の回答にアクセスできるため、他の方への転送はお控えください。\n'+link})
  });
  return reply.ok ? json({ok:true}) : json({error:'email_failed'},503);
}
async function deliver(env,row) {
  if (row.delivered_at) return;
  const all = JSON.parse(row.answers);
  const answers = schema.questions.filter(q=>visible(q,all))
    .map(q=>[q.id,q.label,all[q.id] ?? '']);
  const payload = {submissionId:row.id, company:row.company,contact:row.contact,email:row.email,submittedAt:row.locked_at,answers};
  const response = await fetch(env.GAS_URL,{
    method:'POST',signal:AbortSignal.timeout(20000),
    headers:{'content-type':'application/json'},
    body:JSON.stringify({secret:env.GAS_SECRET,payload})
  });
  if (!response.ok) throw Error('delivery_failed');
  const receipt = await response.json();
  if (receipt.ok!==true || receipt.submissionId!==row.id) throw Error('delivery_failed');
  await env.DB.prepare('UPDATE drafts SET delivered_at=? WHERE id=? AND delivered_at IS NULL').bind(Date.now(),row.id).run();
}
async function draft(request,env,path,data) {
  const secret = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
  if (!secret) return json({error:'invalid_or_expired'},401);
  let row = await env.DB.prepare('SELECT * FROM drafts WHERE resume_hash=? AND expires_at>?').bind(await digest(env.HASH_KEY,secret),Date.now()).first();
  if (!row) return json({error:'invalid_or_expired'},401);
  if (request.method==='GET') return json({
    company:row.company, answers:row.locked_at ? {} : JSON.parse(row.answers), revision:row.revision,
    state:row.delivered_at?'submitted':row.locked_at?'pending':'draft'
  });
  const submitting = path.endsWith('/submit');
  if (row.locked_at) {
    if (!submitting) return json({error:'conflict'},409);
    await deliver(env,row);
    return json({ok:true,submissionId:row.id});
  }
  const {answers,revision} = data;
  if (!Number.isSafeInteger(revision) || !answers || typeof answers!=='object' || Array.isArray(answers)) return json({error:'invalid_answers'},400);
  for (const [id,value] of Object.entries(answers)) {
    if (!forms.has(id) || !['string','object'].includes(typeof value) || value===null || problem(forms.get(id),value,false)) return json({error:'invalid_answers',question:id},400);
  }
  Object.assign(answers,{S01Q01:row.company,S01Q02:row.contact,S01Q03:row.email});
  const errors = submitting ? schema.questions.filter(q=>visible(q,answers) && problem(q,answers[q.id],true)).map(q=>q.id) : [];
  if (errors.length) return json({error:'required',questions:errors},422);
  row = await env.DB.prepare('UPDATE drafts SET answers=?, revision=revision+1, locked_at=? WHERE id=? AND revision=? AND locked_at IS NULL AND expires_at>? RETURNING *')
    .bind(JSON.stringify(answers),submitting?Date.now():null,row.id,revision,Date.now()).first();
  if (!row) return json({error:'conflict'},409);
  if (!submitting) return json({ok:true,revision:row.revision});
  await deliver(env,row);
  return json({ok:true,submissionId:row.id});
}

export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    if (url.pathname==='/api/v2/schema' && request.method==='GET') return json(schema);
    if (!url.pathname.startsWith('/api/')) {
      if (url.pathname==='/') return Response.redirect(new URL('/hearing-v2/',url));
      const asset = await env.ASSETS.fetch(request);
      const result = new Response(asset.body,asset);
      for (const [key,value] of Object.entries(headers)) result.headers.set(key,value);
      return result;
    }
    if (!routes.has(url.pathname)) return json({error:'not_found'},404);
    if (!routes.get(url.pathname).includes(request.method)) return json({error:'method'},405);
    if (url.origin!==env.PUBLIC_ORIGIN || (request.method==='POST' && request.headers.get('origin')!==env.PUBLIC_ORIGIN)) return json({error:'origin_denied'},403);
    const data = request.method==='POST' ? await parse(request) : {};
    if (!data) return json({error:'invalid_request'},400);
    try {
      return await (url.pathname.endsWith('/start') ? start(env,request,data) : draft(request,env,url.pathname,data));
    } catch {
      return json({error:'temporary_failure'},503);
    }
  },
  async scheduled(_event,env,ctx) {
    await env.DB.prepare('DELETE FROM limits WHERE expires_at<=?').bind(Date.now()).run();
    await env.DB.prepare('DELETE FROM drafts WHERE expires_at<=? AND (locked_at IS NULL OR delivered_at IS NOT NULL)').bind(Date.now()).run();
    const {results} = await env.DB.prepare('SELECT * FROM drafts WHERE locked_at IS NOT NULL AND delivered_at IS NULL ORDER BY locked_at LIMIT 20').all();
    ctx.waitUntil(Promise.allSettled(results.map(row=>deliver(env,row))));
  }
};
