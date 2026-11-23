import assert from 'node:assert/strict';
import schema from '../hearing-v1.1/dist/schema.json' with {type:'json'};
import {fixture} from './preview.mjs';
import {options,visible} from './public/hearing-v2/core.mjs';

const origin='http://localhost';
const app=fixture(origin);
async function call(path,body,secret) {
  const headers={origin,'content-type':'application/json'};
  if (secret) headers.authorization='Bearer '+secret;
  const response=await app.handle(new Request(origin+'/api/v2/'+path,{
    headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined
  }));
  return [response.status,await response.json()];
}
try {
  const [,loaded]=await call('schema');
  assert.deepEqual(loaded,schema);
  assert.equal(loaded.questions.length,162);
  assert.equal(loaded.sections.length,16);
  for (const id of ['A','B']) {
    assert.equal((await call('start',{company:id,contact:'Test',email:id+'@example.invalid'}))[0],200);
  }
  const [a,b]=app.mailbox.map(message=>message.text.split('#resume=')[1]);
  assert.equal((await call('draft',null,a))[1].company,'A');
  assert.equal((await call('draft',null,b))[1].company,'B');
  assert.equal((await call('draft',null,'0'.repeat(64)))[0],401);
  assert.equal((await call('draft',null))[0],401);
  const marker={S08Q01:'あり',S08Q02:'https://example.invalid'};
  assert.equal((await call('draft',{answers:marker,revision:0},a))[0],200);
  assert.equal((await call('draft',null,a))[1].answers.S08Q02,marker.S08Q02);
  assert.equal((await call('draft',null,b))[1].answers.S08Q02,undefined);
  assert.equal((await call('draft',{answers:marker,revision:0},a))[0],409);
  assert.equal((await call('submit',{answers:marker,revision:1},a))[0],422);
  const answers={...marker};
  for (const q of schema.questions) {
    if (q.id in answers) continue;
    answers[q.id]=q.type==='multi'?options(q).slice(0,1):options(q)[0] ??
      (q.type==='email'?'a@example.invalid':q.type==='url'?'https://example.invalid':'架空回答');
  }
  const current=await Promise.all([call('submit',{answers,revision:1},a),call('submit',{answers,revision:1},a)]);
  assert.ok(current.some(([status])=>status===200));
  assert.ok(current.every(([status])=>status===200 || status===409));
  assert.equal((await call('submit',{},a))[0],200);
  assert.equal(app.sheets.size,1);
  const [delivery]=app.sheets.values();
  assert.equal(delivery.company,'A');
  assert.deepEqual(delivery.answers.map(([id])=>id),schema.questions.filter(q=>visible(q,answers)).map(q=>q.id));
  assert.equal((await call('draft',{answers,revision:2},a))[0],409);
  assert.equal((await call('draft',null,a))[1].state,'submitted');
  assert.equal((await call('draft',null,b))[1].state,'draft');
  app.db.prepare('UPDATE drafts SET expires_at=0 WHERE company=?').run('B');
  assert.equal((await call('draft',null,b))[0],401);
  const denied=await app.handle(new Request(origin+'/api/v2/start',{method:'POST',headers:{origin:'https://other.invalid'}}));
  assert.equal(denied.status,403);
  console.log('PASS: schema parity, two companies, restored draft, revision conflict, required answers, filtered delivery, concurrent/repeated submit, expired/invalid token, origin');
} finally {app.restore();}
