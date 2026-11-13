const ID=/^[-a-zA-Z0-9]{3,80}$/;
export function registry(env){
  const r=JSON.parse(env.ACCESS_REGISTRY||'{"version":1,"grants":[]}');
  if(r.version!==1||!Array.isArray(r.grants)||r.grants.length>2000)throw Error('access_configuration');
  const seen=new Set();
  for(const g of r.grants){
    if(!g||!ID.test(g.projectId)||!ID.test(g.userId)||typeof g.enabled!=='boolean'||!Number.isFinite(Date.parse(g.expiresAt))||seen.has(g.userId+'|'+g.projectId))throw Error('access_configuration');
    seen.add(g.userId+'|'+g.projectId);
  }
  return r;
}
export function principal(request,env,projectId,now=Date.now()){
  const userId=request.headers.get('oai-authenticated-user-id');
  if(!userId)return {status:401,error:'authentication_required'};
  const operators=(env.OPERATOR_IDS||'').split(',').filter(Boolean);
  let r;try{r=registry(env)}catch{return {status:503,error:'access_configuration'}}
  const isOperator=operators.includes(userId);
  if(env.DEPLOYMENT_MODE==='review'){
    // This branch is only permitted on an owner-private Sites deployment.
    if(env.REVIEW_OWNER_ONLY_CONFIRMED!=='true')return {status:503,error:'review_boundary_not_confirmed'};
    if(projectId&&projectId!=='QA-V11-OWNER')return {status:403,error:'project_forbidden'};
    return {userId,role:isOperator?'operator':'review',projectId:'QA-V11-OWNER',projects:['QA-V11-OWNER'],expiresAt:null,review:true};
  }
  if(env.DEPLOYMENT_MODE!=='clients'||env.CLIENT_RELEASE_APPROVED!=='true')return {status:403,error:'client_release_not_approved'};
  const active=r.grants.filter(g=>g.userId===userId&&g.enabled&&Date.parse(g.expiresAt)>now);
  const g=projectId?active.find(g=>g.projectId===projectId):active.length===1?active[0]:null;
  if(!g)return {status:403,error:active.length>1&&!projectId?'project_selection_required':'project_forbidden',projects:active.map(g=>g.projectId)};
  return {userId,role:isOperator?'operator':'client',projectId:g.projectId,projects:active.map(g=>g.projectId),expiresAt:g.expiresAt,review:false};
}
export async function storageId(projectId,id){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(projectId+'\0'+id));
  return 'V11-'+[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function readBounded(request,limit=400000){
  if(Number(request.headers.get('content-length'))>limit)throw Error('payload_too_large');
  if(!request.body)return '';
  const reader=request.body.getReader(),parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('payload_too_large')}parts.push(value)}
  const all=new Uint8Array(size);let n=0;for(const b of parts){all.set(b,n);n+=b.length}return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
