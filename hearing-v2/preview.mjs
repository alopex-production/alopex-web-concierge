import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from './worker.mjs';

export function fixture(origin) {
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  const mailbox=[];
  const sheets=new Map();
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url,init)=>{
    if (url==='https://api.resend.com/emails') {
      mailbox.push(JSON.parse(init.body));
      return Response.json({ok:true});
    }
    if (url==='https://fixture.invalid/gas') {
      const {payload}=JSON.parse(init.body);
      if (!sheets.has(payload.submissionId)) sheets.set(payload.submissionId,payload);
      return Response.json({ok:true,submissionId:payload.submissionId});
    }
    return originalFetch(url,init);
  };
  const files=new Map([
    ['/hearing-v2/',['index.html','text/html; charset=utf-8']],
    ['/hearing-v2/app.mjs',['app.mjs','text/javascript']],
    ['/hearing-v2/core.mjs',['core.mjs','text/javascript']],
    ['/hearing-v2/style.css',['style.css','text/css']],
    ['/hearing-v2/alopex-logo.PNG',['alopex-logo.PNG','image/png']]
  ]);
  const env={
    DB:{prepare(sql){return {bind(...args){
      const statement=db.prepare(sql);
      return {first:async()=>statement.get(...args),run:async()=>statement.run(...args),all:async()=>({results:statement.all(...args)})};
    }};}},
    PUBLIC_ORIGIN:origin, HASH_KEY:'local-qa-only', RESEND_API_KEY:'local-qa-only', EMAIL_FROM:'qa@example.invalid',
    GAS_URL:'https://fixture.invalid/gas',GAS_SECRET:'local-qa-only',
    ASSETS:{fetch(request) {
      const file=files.get(new URL(request.url).pathname);
      return file ? new Response(readFileSync(new URL('./public/hearing-v2/'+file[0],import.meta.url)),{headers:{'content-type':file[1]}})
        : new Response('Not found',{status:404});
    }}
  };
  return {db,mailbox,sheets,env,handle:request=>worker.fetch(request,env),restore:()=>{globalThis.fetch=originalFetch;}};
}
if (process.argv[1] && new URL('file:'+process.argv[1]).href===import.meta.url) {
  const port=4178;
  const origin='http://127.0.0.1:'+port;
  const app=fixture(origin);
  createServer(async (req,res)=>{
    try {
      const url=new URL(req.url,origin);
      if (url.pathname==='/__test_mail') {
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
        const links=app.mailbox.map((message,index)=>{
          const path=new URL(message.text.split('\n').at(-1));
          return '<li><a href="'+path.pathname+path.hash+'">テストメール '+(index+1)+' を開く</a></li>';
        }).join('');
        return res.end('<meta charset="utf-8"><title>テスト受信箱</title><h1>ローカル検証用の受信箱</h1><p>架空の情報だけを入力してください。外部メールは送信されません。</p><a href="/hearing-v2/">ヒアリングを開く</a><ol>'+links+'</ol>');
      }
      const chunks=[];
      let bytes=0;
      for await (const chunk of req) {
        bytes+=chunk.length;
        if (bytes>800000) { res.writeHead(413); return res.end(); }
        chunks.push(chunk);
      }
      const request=new Request(url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const reply=await app.handle(request);
      res.writeHead(reply.status,Object.fromEntries(reply.headers));
      res.end(Buffer.from(await reply.arrayBuffer()));
    } catch { res.writeHead(500); res.end(); }
  }).listen(port,'127.0.0.1',()=>console.log(origin+'/hearing-v2/'));
}
