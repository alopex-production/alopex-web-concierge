import {options,visible,problem} from './core.mjs';

const el=id=>document.getElementById(id);
function notice(id,text,error=false) {
  el(id).textContent=text;
  el(id).toggleAttribute('data-error',error);
}
const status=(text,error=false)=>notice('status',text,error);
const issues=new Map();
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
  el('meter').max=required.length || 1;
  el('meter').value=filled;
  el('progress').textContent='必須回答 '+filled+' / '+required.length+(dirty?' · 未保存の変更あり':'');
}
function change(q,value) {
  answers[q.id]=value;
  if (issues.delete(q.id)) {
    const field=el(q.id);
    field?.removeAttribute('aria-invalid');
    field?.removeAttribute('aria-describedby');
    el(q.id+'-error')?.remove();
  }
  dirty=true;
  if (schema.questions.some(item=>item.when?.[0]===q.id || item.unless?.[0]===q.id)) {
    render();
    document.getElementById(q.id)?.focus();
  } else updateProgress();
}
function render() {
  el('heading').textContent=schema.sections[section];
  el('step').textContent='分野 '+(section+1)+' / '+schema.sections.length;
  for (const [index,button] of [...el('section-list').querySelectorAll('button')].entries()) {
    if (index===section) button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  }
  el('section').value=String(section);
  el('prev').disabled=section===0;
  el('next').hidden=section===schema.sections.length-1;
  el('submit').hidden=section!==schema.sections.length-1;
  const list=el('questions');
  list.replaceChildren();
  for (const q of schema.questions.filter(q=>q.section===section && visible(q,answers))) {
    const tag=element('span',q.required?'必須':'任意');
    tag.className=q.required?'tag required':'tag';
    const error=issues.get(q.id);
    if (q.type==='multi') {
      const group=element('fieldset');
      group.id=q.id;
      group.tabIndex=-1;
      const legend=element('legend',q.label);
      legend.append(tag);
      group.append(legend);
      if (error) {
        group.setAttribute('aria-invalid','true');
        const feedback=element('p',error);
        feedback.id=q.id+'-error';
        group.setAttribute('aria-describedby',feedback.id);
        group.append(feedback);
      }
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
    const label=element('label',q.label);
    label.append(tag);
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
    if (error) {
      const feedback=element('small',error);
      feedback.id=q.id+'-error';
      input.setAttribute('aria-invalid','true');
      input.setAttribute('aria-describedby',feedback.id);
      label.append(feedback);
    }
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
  el('confirm').hidden=true;
  el('complete').hidden=false;
  status('');
  el('complete-title').focus();
}
async function action(button,work) {
  if (busy) return;
  busy=true;
  button.disabled=true;
  try { await work(); }
  catch (error) { status(messages[error.message]||'処理を確認できませんでした。時間をおいて再度お試しください。',true); }
  finally { busy=false; button.disabled=false; }
}
el('entry').onsubmit=event=>{
  event.preventDefault();
  action(event.submitter,async()=>{
    status('専用リンクを送信しています…');
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
  notice('save-status','保存しています…');
  try {
    revision=(await api('draft',{answers,revision})).revision;
    dirty=snapshot!==JSON.stringify(answers);
    updateProgress();
    const time=new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'}).format(new Date());
    notice('save-status',time+' に保存しました。'+(dirty?' その後の変更は未保存です。':''));
  } catch (error) {
    notice('save-status',messages[error.message]||'保存できませんでした。「途中保存」から再試行してください。',true);
  }
});
function showReview() {
  issues.clear();
  const active=schema.questions.filter(q=>visible(q,answers));
  for (const q of active) {
    const error=problem(q,answers[q.id],true);
    if (error) issues.set(q.id,error);
  }
  if (issues.size) {
    const first=active.find(q=>issues.has(q.id));
    status('確認が必要な項目が '+issues.size+' 件あります。最初の項目は「'+first.label+'」です。',true);
    move(first.section);
    el(first.id)?.focus();
    return;
  }
  const review=el('review');
  review.replaceChildren();
  schema.sections.forEach((name,index)=>{
    const details=element('details');
    details.append(element('summary',name));
    const list=element('dl');
    for (const q of active.filter(item=>item.section===index)) {
      const value=answers[q.id];
      list.append(element('dt',q.label),element('dd',(Array.isArray(value)?value.join('、'):value)||'未回答'));
    }
    details.append(list);
    review.append(details);
  });
  status('');
  el('workspace').hidden=true;
  el('confirm').hidden=false;
  el('confirm-title').focus();
}
el('submit').onclick=showReview;
el('cancel').onclick=()=>{
  if (busy) return;
  el('confirm').hidden=true;
  el('workspace').hidden=false;
  el('submit').focus();
};
el('finalize').onclick=()=>action(el('finalize'),async()=>{
  status('回答を送信しています…');
  await api('submit',{answers,revision});
  completed();
});
el('retry').onclick=()=>action(el('retry'),async()=>{
  await api('submit',{});
  completed();
});

async function initialize() {
  if (!secret) { el('entry').hidden=false; return; }
  el('entry-layout').hidden=true;
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
      const row=element('li');
      const button=element('button',name);
      button.onclick=()=>move(index);
      row.append(button);
      el('section-list').append(row);
    });
    el('workspace').hidden=false;
    render();
    status(draft.company+' 様');
  } catch (error) {
    status(messages[error.message]||'回答を読み込めませんでした。再開メールから開き直してください。',true);
    el('home').hidden=false;
  }
}
initialize();
