import {options,visible,problem} from './core.mjs';

const el=id=>document.getElementById(id);
const status=text=>{el('status').textContent=text;};
const messages={
  invalid_or_expired:'リンクが無効か、有効期限が切れています。',
  rate_limit:'送信回数の上限に達しました。時間をおいてお試しください。',
  conflict:'別の画面で回答が更新されました。再開メールから開き直してください。',
  email_failed:'メール送信を確認できませんでした。受信箱を確認し、届いていなければ再度お試しください。',
  invalid_contact:'会社名・担当者名・メールアドレスを確認してください。'
};
let schema,answers,revision,section=0,busy=false,dirty=false;
let secret=new URLSearchParams(location.hash.slice(1)).get('resume');
if (location.hash) {
  if (/^[a-f0-9]{64}$/.test(secret||'')) sessionStorage.setItem('alopex-v2',secret);
  else sessionStorage.removeItem('alopex-v2');
  history.replaceState(null,'',location.pathname);
}
secret=secret||sessionStorage.getItem('alopex-v2');
el('home').onclick=()=>sessionStorage.removeItem('alopex-v2');
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});

async function api(name,body) {
  const headers={};
  if (secret) headers.Authorization='Bearer '+secret;
  if (body) headers['content-type']='application/json';
  const response=await fetch('/api/v2/'+name,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if (!response.ok) throw Object.assign(Error(data.error),data);
  return data;
}
function element(tag,text) {
  const node=document.createElement(tag);
  if (text!==undefined) node.textContent=text;
  return node;
}
function updateProgress() {
  const active=schema.questions.filter(q=>visible(q,answers));
  const required=active.filter(q=>q.required);
  const filled=required.filter(q=>!problem(q,answers[q.id],true)).length;
  el('progress').textContent='必須回答 '+filled+' / '+required.length+(dirty?' · 未保存の変更あり':'');
}
function change(q,value) {
  answers[q.id]=value;
  dirty=true;
  if (schema.questions.some(item=>item.when?.[0]===q.id || item.unless?.[0]===q.id)) {
    render();
    document.getElementById(q.id)?.focus();
  } else updateProgress();
}
function render() {
  el('heading').textContent=schema.sections[section];
  el('section').value=String(section);
  el('prev').disabled=section===0;
  el('next').hidden=section===schema.sections.length-1;
  el('submit').hidden=section!==schema.sections.length-1;
  el('confirm').hidden=true;
  const list=el('questions');
  list.replaceChildren();
  for (const q of schema.questions.filter(q=>q.section===section && visible(q,answers))) {
    const title=q.label+(q.required?'（必須）':'');
    if (q.type==='multi') {
      const group=element('fieldset');
      group.append(element('legend',title));
      for (const option of q.options) {
        const label=element('label');
        const input=element('input');
        input.type='checkbox';
        input.value=option;
        input.checked=answers[q.id]?.includes(option)||false;
        input.onchange=()=>change(q,[...group.querySelectorAll(':checked')].map(node=>node.value));
        label.append(input,document.createTextNode(option));
        group.append(label);
      }
      list.append(group);
      continue;
    }
    const select=['single','design'].includes(q.type);
    const label=element('label',title);
    const input=element(select?'select':q.type==='text'?'textarea':'input');
    input.id=q.id;
    if (select) {
      const empty=element('option','選択してください');
      empty.value='';
      input.append(empty);
      for (const option of options(q)) input.append(element('option',option));
      input.onchange=()=>change(q,input.value);
    } else {
      if (input.tagName==='INPUT') input.type=q.type;
      input.maxLength=1200;
      input.readOnly=['S01Q01','S01Q02','S01Q03'].includes(q.id);
      input.oninput=()=>change(q,input.value);
    }
    input.value=answers[q.id]??'';
    label.append(input);
    list.append(label);
  }
  updateProgress();
}
function move(to) {
  section=to;
  render();
  el('heading').focus();
}
function completed() {
  dirty=false;
  el('workspace').hidden=true;
  el('retry').hidden=true;
  status('回答を受け付けました。ご協力ありがとうございました。');
}
async function action(button,work) {
  if (busy) return;
  busy=true;
  button.disabled=true;
  try { await work(); }
  catch (error) { status(messages[error.message]||'処理を確認できませんでした。時間をおいて再度お試しください。'); }
  finally { busy=false; button.disabled=false; }
}
el('entry').onsubmit=event=>{
  event.preventDefault();
  action(event.submitter,async()=>{
    await api('start',Object.fromEntries(new FormData(el('entry'))));
    el('entry').hidden=true;
    status('専用リンクを送信しました。メールを開いて回答を開始してください。');
  });
};
el('prev').onclick=()=>move(section-1);
el('next').onclick=()=>move(section+1);
el('section').onchange=event=>move(Number(event.target.value));
el('save').onclick=()=>action(el('save'),async()=>{
  const snapshot=JSON.stringify(answers);
  revision=(await api('draft',{answers,revision})).revision;
  dirty=snapshot!==JSON.stringify(answers);
  updateProgress();
  status('途中回答を保存しました。');
});
el('submit').onclick=()=>{
  const missing=schema.questions.find(q=>visible(q,answers) && problem(q,answers[q.id],true));
  if (missing) {
    status(missing.label+'を確認してください。');
    move(missing.section);
    return;
  }
  el('confirm').hidden=false;
  el('finalize').focus();
};
el('cancel').onclick=()=>{el('confirm').hidden=true;};
el('finalize').onclick=()=>action(el('finalize'),async()=>{
  await api('submit',{answers,revision});
  completed();
});
el('retry').onclick=()=>action(el('retry'),async()=>{
  await api('submit',{});
  completed();
});

async function initialize() {
  if (!secret) { el('entry').hidden=false; return; }
  status('保存した回答を確認しています。');
  try {
    const draft=await api('draft');
    if (draft.state==='submitted') return completed();
    if (draft.state==='pending') {
      status('回答は確定済みです。保存先への送信状況を確認できます。');
      el('retry').hidden=false;
      return;
    }
    schema=await api('schema');
    answers=draft.answers;
    revision=draft.revision;
    schema.sections.forEach((name,index)=>{
      const item=element('option',name);
      item.value=index;
      el('section').append(item);
    });
    el('workspace').hidden=false;
    render();
    status(draft.company+' 様');
  } catch (error) {
    status(messages[error.message]||'回答を読み込めませんでした。再開メールから開き直してください。');
    el('home').hidden=false;
  }
}
initialize();
