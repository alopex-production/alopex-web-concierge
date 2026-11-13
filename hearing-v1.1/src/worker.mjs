const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
export default {async fetch(request,env){
  const url=new URL(request.url),method=request.method;
  if(url.pathname==='/api/access'){
    if(method!=='POST')return json({error:'method'},405);
    if(request.headers.get('Origin')!==url.origin)return json({error:'origin'},403);
    try{const data=JSON.parse(await readBounded(request,1024));const result=await exchangeLink(data.token,env);if(result.status)return json({error:result.error},result.status);const response=json({ok:true,projectId:result.projectId,expiresAt:result.expiresAt});response.headers.set('Set-Cookie',result.cookie);return response;}catch{return json({error:'invalid_link'},400)}
  }
  if(url.pathname==='/api/identity'){
    if(method!=='GET')return json({error:'method'},405);
    const userId=request.headers.get('oai-authenticated-user-id');
    return userId?json({userId}):json({error:'authentication_required'},401);
  }
  if(url.pathname==='/api/session'){
    if(method!=='GET')return json({error:'method'},405);
    const p=await clientPrincipal(request,env,url.searchParams.get('projectId'));
    return p.status?json(p,p.status):json({userId:p.userId,role:p.role,projectId:p.projectId,projects:p.projects,expiresAt:p.expiresAt,review:p.review,draftMaxAgeHours:24,schemaVersion:schema.version});
  }
  if(url.pathname==='/api/ops/access'){
    if(method!=='GET')return json({error:'method'},405);
    const uid=request.headers.get('oai-authenticated-user-id');
    if(!uid)return json({error:'authentication_required'},401);
    if(!(env.OPERATOR_IDS||'').split(',').includes(uid))return json({error:'operator_required'},403);
    try{const r=registry(env);return json({mode:env.DEPLOYMENT_MODE,clientReleaseApproved:env.CLIENT_RELEASE_APPROVED==='true',registry:r,storageConnected:!!env.GAS_URL&&!!env.GAS_SECRET,backupPolicy:'MANUAL_BEFORE_CHANGE',retentionPolicy:env.RETENTION_POLICY||'AWAITING_OWNER_APPROVAL'})}catch{return json({error:'access_configuration'},503)}
  }
  if(url.pathname==='/api/submit'){
    if(method!=='POST')return json({error:'method'},405);
    if(request.headers.get('Origin')!==url.origin)return json({error:'origin'},403);
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'content_type'},415);
    let d;try{d=JSON.parse(await readBounded(request))}catch(e){return json({error:e.message==='payload_too_large'?'size':'invalid_json'},e.message==='payload_too_large'?413:400)}
    if(!d||typeof d!=='object'||Array.isArray(d)||d.schemaVersion!==schema.version||!Array.isArray(d.answers)||d.answers.length>200||!/^[-a-zA-Z0-9]{8,80}$/.test(d.submissionId)||!/^[-a-zA-Z0-9]{3,80}$/.test(d.projectId))return json({error:'invalid_payload'},400);
    const p=await clientPrincipal(request,env,d.projectId);if(p.status)return json({error:p.error},p.status);
    if(env.ACCEPT_SUBMISSIONS!=='true')return json({error:'受付を停止しています。回答は保持されます。'},503);
    if(!env.GAS_URL||!env.GAS_SECRET||!/^https:\/\/script.google.com\/macros\/s\/[^/]+\/exec$/.test(env.GAS_URL))return json({error:'receiver_configuration'},503);
    const a=Object.create(null);
    for(const x of d.answers){
      if(!x||typeof x.questionId!=='string'||Object.hasOwn(a,x.questionId)||typeof x.note!=='string'||x.note.length>2000)return json({error:'invalid_answer'},400);
      a[x.questionId]=x.answer;
    }
    const qs=schema.questions.filter(q=>visible(q,a));
    if(qs.length!==d.answers.length||qs.some(q=>!Object.hasOwn(a,q.id)||validate(q,a[q.id])||q.type==='multi'&&(!Array.isArray(a[q.id])||new Set(a[q.id]).size!==a[q.id].length)||q.type!=='multi'&&(typeof a[q.id]!=='string'||a[q.id].length>2000)))return json({error:'invalid_answers'},400);
    const sid=await storageId(p.projectId,d.submissionId);
    try{
      const upstream=await fetch(env.GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({schemaVersion:schema.version,projectId:p.projectId,submissionId:sid,answers:d.answers,secret:env.GAS_SECRET}),signal:AbortSignal.timeout(25000)});
      if(!upstream.ok)throw Error('upstream_http');
      const r=await upstream.json();
      if(r.ok!==true||r.submissionId!==sid)return json({error:r.error==='rate_limited_retry_after_60s'?'続けて送信されています。60秒後に再試行してください。':'保存を確認できませんでした。同じ受付IDで再試行してください。'},r.error==='rate_limited_retry_after_60s'?429:502);
      return json({ok:true,submissionId:d.submissionId,storageId:sid,duplicate:r.duplicate===true});
    }catch{return json({error:'送信先に接続できません。同じ受付IDで再試行してください。'},502)}
  }
  if(!['GET','HEAD'].includes(method))return new Response('Method not allowed',{status:405,headers});
  if(url.pathname==='/ops'){
    const uid=request.headers.get('oai-authenticated-user-id');
    if(!uid)return json({error:'authentication_required'},401);
    if(!(env.OPERATOR_IDS||'').split(',').includes(uid))return json({error:'operator_required'},403);
  }
  if(url.pathname==='/schema.json'){const p=await clientPrincipal(request,env,null);if(p.status)return json({error:p.error},p.status)}
  const asset=assets[url.pathname==='/'?'/index.html':url.pathname==='/ops'?'/ops.html':url.pathname];
  if(!asset||url.pathname==='/ops.html')return new Response('Not found',{status:404,headers});
  return new Response(method==='HEAD'?null:asset.body,{headers:{...headers,'Content-Type':asset.type}});
}};
