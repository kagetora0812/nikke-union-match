'use strict';
// 案内専用。入力・アップロード・送信・外部API通信は行わない。
const $ = id => document.getElementById(id);
let type = 'commander';
let mode = 'recruit';
let index = 0;
const shared = {
  type:{title:'登録タイプ',text:'指揮官として移籍先を探す方は「指揮官」、メンバーを募集するユニオンの方は「ユニオン」を選択してください。',hint:'次は名前の項目へ進みます。'},
  url:{title:'募集記事URL・募集記事の画像',text:'X・BlablaLink・Discordなどに投稿した募集記事のURLを入力してください。募集画像がある場合は画像選択欄から追加できます。画像の登録は任意です。',hint:'次は「管理期間」へ進みます。'},
  confirm:{title:'登録内容を確認する',text:'入力内容を確認し、問題がなければ登録を完了します。',hint:'次はガイド終了画面です。'}
};
const commander = {
  name:{title:'指揮官名',text:'ゲーム内で使用している指揮官名を入力します。',hint:'次は「SLV」へ進みます。'},
  slv:{title:'SLV',text:'現在のシンクロレベルを入力します。',hint:'次は「募集記事URL」へ進みます。'},
  period:{title:'管理期間：14日間',text:'掲載期間は14日間です。指揮官の募集は延長できません。',hint:'次は「登録内容を確認する」へ進みます。'}
};
const union = {
  name:{title:'ユニオン名',text:'ゲーム内のユニオン名を入力します。',hint:'次は「ユニオンランク」へ進みます。'},
  rank:{title:'ユニオンランク',text:'ユニオンレイドでのランクを選択してください。',hint:'次は「利用方法」へ進みます。'},
  usage:{title:'利用方法',text:'メンバーを募集する場合は「募集する」、募集せずにユニオン名だけを登録する場合は「登録のみ」を選択してください。',hint:'選択した利用方法に合わせて次へ進みます。'},
  period:{title:'管理期間：14日間',text:'管理期間は14日間です。PASS管理から登録情報の変更・削除、募集状況の切り替え、掲載期限の延長ができます。Discord BOTを利用している場合は、期限通知からPASS不要で期限延長や募集状況の切り替えもできます。',hint:'次は「登録内容を確認する」へ進みます。'},
  confirm:{title:'登録内容を確認する',text:'入力内容を確認して登録します。登録完了後に発行される8文字のPASSは大切に保管してください。',hint:'次はガイド終了画面です。'}
};
function steps(){return type==='commander'?['type','name','slv','url','period','confirm']:['type','name','rank','usage',...(mode==='recruit'?['url']:[]),'period','confirm'];}
function mock(key){
 switch(key){
 case 'type':return `<div class="demo-label">登録タイプ</div><div class="choice-row"><button type="button" class="choice ${type==='commander'?'active':''}" data-type="commander" aria-pressed="${type==='commander'}">指揮官</button><button type="button" class="choice ${type==='union'?'active':''}" data-type="union" aria-pressed="${type==='union'}">ユニオン</button></div>`;
 case 'usage':return `<div class="demo-label">利用方法</div><div class="choice-row"><button type="button" class="choice ${mode==='recruit'?'active':''}" data-mode="recruit" aria-pressed="${mode==='recruit'}">募集する</button><button type="button" class="choice ${mode==='register-only'?'active':''}" data-mode="register-only" aria-pressed="${mode==='register-only'}">登録のみ</button></div>`;
 case 'name':return `<label>${type==='union'?'ユニオン名':'指揮官名'}</label><div class="mock-input">${type==='union'?'ユニオン名を入力':'指揮官名を入力'}</div>`;
 case 'slv':return '<label>SLV</label><div class="mock-input">例：850</div>';
 case 'rank':return '<label>ユニオンランク</label><div class="mock-select">チャレンジャー　⌄</div>';
 case 'url':return '<label>募集記事URL</label><div class="mock-input">https://...</div><label style="margin-top:15px">募集記事の画像（任意）</label><div class="mock-input">画像を選択</div>';
 case 'period':return '<div class="demo-label">管理期間：14日間</div><div class="demo-note">登録情報の管理期間について</div>';
 case 'confirm':return '<div class="mock-action">登録内容を確認する</div>';
 }
}
function render(){
 const list=steps();const key=list[index];const data=key==='type'?shared.type:(type==='commander'?commander[key]||shared[key]:union[key]||shared[key]);
 $('guideCard').hidden=false;$('finish').hidden=true;
 $('stepLabel').textContent='REGISTER GUIDE';$('stepCount').textContent=`STEP ${index+1} / ${list.length}`;
 $('trackFill').style.width=`${(index+1)/list.length*100}%`;
 $('demo').innerHTML=mock(key);
 $('descriptionTitle').textContent=data.title;
 const desc=$('descriptionText');desc.replaceChildren();
 const p=document.createElement('p');p.textContent=data.text;desc.append(p);
 if(key==='usage'&&mode==='register-only'){
  const a=document.createElement('p');a.textContent='ユニオン名のみを登録します。募集記事は掲載されず、「ユニオンリスト」に名前が表示されます。募集を再開する際は、PASS管理から「募集する」に切り替えられます。';desc.append(a);
  const b=document.createElement('div');b.className='extra';b.textContent='登録のみでもDiscord BOTが利用できます！ NIKKE公式の最新イベント情報や新キャラクター情報、ログイン通知などをDiscordで受け取れます。さらに、移籍先を探している指揮官の新着情報もお知らせします。';desc.append(b);
 }else if(key==='usage'){
  const a=document.createElement('p');a.textContent='「募集する」では募集記事を掲載して、ユニオンメンバーを募集します。';desc.append(a);
 }
 const h=document.createElement('p');h.className='hint';h.textContent=key==='usage'&&mode==='register-only'?'次は「管理期間」へ進みます。':data.hint;desc.append(h);
 $('back').disabled=index===0;$('next').textContent=index===list.length-1?'ガイド終了 →':'次へ →';
 document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{type=b.dataset.type;mode='recruit';render();}));
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render();}));
}
function showFinish(){ $('guideCard').hidden=true;$('finish').hidden=false;$('extensionFeature').hidden=type==='commander'; }
$('back').addEventListener('click',()=>{if(index>0){index--;render();}});
$('next').addEventListener('click',()=>{if(index+1<steps().length){index++;render();}else showFinish();});
$('finishBack').addEventListener('click',()=>render());
render();
