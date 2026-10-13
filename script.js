 'use strict';
// 本番公開前に実際の受付メールへ変更してください。
const CONTACT_EMAIL = 'SET_YOUR_EMAIL@example.com';
const questions = [
 {title:'今、事業のどこを変えたいですか？',options:['新しいお客様を増やしたい','一緒に働く仲間を増やしたい','新しい取引先・元請けとつながりたい','お店や会社の魅力をもっと伝えたい','開業に向けて準備したい','何から始めるべきか相談したい']},
 {title:'どのような事業ですか？',options:['店舗・サロン・飲食','建設・設備・職人','教育・スクール','専門サービス・その他','これから開業予定']},
 {title:'現在どの段階ですか？',options:['これから開業する','開業して1年未満','開業して1〜3年','開業して3年以上']},
 {title:'どんな仕掛けに興味がありますか？',options:['ホームページ制作','SNS・公式LINE活用','写真・PR動画制作','採用・求人ページ制作','何が必要か提案してほしい']}
];
let step=0;const answers=Array(questions.length).fill(null);const $=id=>document.getElementById(id);
$('year').textContent=new Date().getFullYear();
function render(){
 $('progressLabel').textContent=`STEP 0${step+1} / 04`;
 $('bar').style.width=`${(step+1)/4*100}%`;
 $('question').replaceChildren();
 const h=document.createElement('h3');h.className='questionTitle';h.textContent=questions[step].title;$('question').append(h);
 questions[step].options.forEach(option=>{
  const label=document.createElement('label');label.className='option';
  const input=document.createElement('input');input.type='radio';input.name='answer';input.value=option;input.checked=answers[step]===option;
  input.addEventListener('change',()=>{answers[step]=option;$('next').disabled=false});
  label.append(input,document.createTextNode(option));$('question').append(label);
 });
 $('back').hidden=step===0;$('next').disabled=!answers[step];$('next').textContent=step===3?'おすすめを見る →':'次へ進む →';
}
$('back').addEventListener('click',()=>{if(step>0){step--;render()}});
$('next').addEventListener('click',()=>{if(!answers[step])return;if(step<3){step++;render()}else showResult()});
function recommend(){
 const goal=answers[0],sector=answers[1],interest=answers[3];
 if(goal.includes('仲間')||interest.includes('採用'))return ['働く魅力を伝える、採用の仕掛け','採用ページと現場・スタッフ紹介コンテンツを整え、仕事内容や職場の雰囲気が伝わる導線をつくるご提案です。'];
 if(goal.includes('取引先')||goal.includes('元請け'))return ['実績を信頼に変える、取引先開拓の仕掛け','施工・業務実績を見やすく整理したWEBページと、対応エリア・資格・強みを伝える情報設計をご提案します。'];
 if(goal.includes('開業'))return ['開業の第一歩を伝える、認知づくりの仕掛け','事業の強みを言葉とビジュアルで整理し、基本WEBページとSNS・問い合わせ窓口を整えるご提案です。'];
 if(goal.includes('お客様'))return ['新しい出会いを生む、集客の仕掛け',sector.includes('建設')?'施工事例・対応地域・問い合わせ動線を整え、直接依頼につながる情報発信をご提案します。':'サービスの魅力と選ばれる理由を伝えるWEB導線を整え、SNSや予約・相談窓口につなげるご提案です。'];
 if(goal.includes('魅力')||interest.includes('動画'))return ['魅力を伝わる形にする、発信の仕掛け','写真・PR動画とWEBページを組み合わせ、事業の価値や人柄が伝わる情報発信をご提案します。'];
 return ['事業の強みを整理する、最初の仕掛け','まずは事業の目標と現状を伺い、WEB・SNS・映像の中から優先順位を整理してご提案します。'];
}
function showResult(){
 const [title,desc]=recommend();$('resultTitle').textContent=title;$('resultDescription').textContent=desc;const goal=answers[0],sector=answers[1],stage=answers[2],interest=answers[3];const hiring=goal.includes('仲間')||interest.includes('採用');const trade=goal.includes('取引先')||goal.includes('元請け');const launch=stage.includes('これから')||sector.includes('これから');let actions=hiring?'採用ページ・スタッフ紹介・職場の写真や動画':trade?'施工／業務実績ページ・対応エリア・問い合わせ導線':launch?'事業紹介ページ・開業告知・相談窓口':'事業紹介ページ・写真やPR動画・SNSからの導線';let reason=hiring?'応募前に仕事内容や働く人の雰囲気を知ってもらうことが大切だからです。':trade?'発注側が実績・対応範囲・信頼性を確認しやすくするためです。':launch?'開業時に必要な情報と問い合わせ先を先に整えるためです。':'お客様が魅力を理解し、次の行動を取りやすくするためです。';if(interest.includes('LINE'))actions+=' ＋ 公式LINEの導線';if(interest.includes('動画'))actions+=' ＋ PR映像';$('resultActions').textContent=actions;$('resultReason').textContent=reason;$('resultSummary').replaceChildren();
 questions.forEach((q,i)=>{const div=document.createElement('div');const strong=document.createElement('strong');strong.textContent=q.title+'：';div.append(strong,document.createTextNode(answers[i]));$('resultSummary').append(div)});
 $('quiz').hidden=true;$('result').hidden=false;$('result').scrollIntoView({behavior:'smooth',block:'start'});
}
$('restart').addEventListener('click',()=>{step=0;answers.fill(null);$('result').hidden=true;$('contact').hidden=true;$('quiz').hidden=false;render();$('diagnosis').scrollIntoView({behavior:'smooth'})});
$('inquire').addEventListener('click',()=>{$('contact').hidden=false;$('contact').scrollIntoView({behavior:'smooth',block:'start'})});
$('contactForm').addEventListener('submit',e=>{
 e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
 if(CONTACT_EMAIL==='SET_YOUR_EMAIL@example.com'){alert('お問い合わせ受付の準備中です。公開前に受信先メールアドレスを設定してください。');return}
 const data=new FormData(form),rec=recommend();
 const subject='【ALOPEX WEB CONCIERGE】無料相談のお申し込み';
 const body=[`お名前：${data.get('name')}`,`会社名・屋号：${data.get('company')||'未入力'}`,`メールアドレス：${data.get('email')}`,'','【診断結果】',rec[0],rec[1],'','【診断の回答】',...questions.map((q,i)=>`${q.title} ${answers[i]}`),'','【ご相談内容】',data.get('message')].join('\n');
 window.location.href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
 $('confirmation').hidden=false;
});
render();