'use strict';
// 本体の登録フォームへ入力値と任意画像を引き継ぎ、既存の確認画面を開く。
const $=id=>document.getElementById(id);
const state={type:'commander',mode:'recruit',name:'',unionName:'',slv:'',rank:'チャレンジャー',url:'',image:null};
let index=0;
const commanderSteps=['type','name','slv','url','period','confirm'];
const unionSteps=['type','name','rank','usage','url','period','confirm'];
const steps=()=>state.type==='commander'?commanderSteps:unionSteps.filter(k=>k!=='url'||state.mode==='recruit');
const labels={type:'登録タイプ',name:'指揮官名／ユニオン名',slv:'SLV',rank:'ユニオンランク',usage:'利用方法',url:'募集記事URL・画像',period:'管理期間：14日間',confirm:'登録内容を確認する'};
const info={type:['登録タイプ','指揮官として移籍先を探す方は「指揮官」、メンバーを募集するユニオンの方は「ユニオン」を選択してください。'],name:['名前を入力','ゲーム内で使用している名前を入力してください。'],slv:['SLV','現在のシンクロレベルを入力してください。'],rank:['ユニオンランク','ユニオンレイドでのランクを選択してください。'],usage:['利用方法','メンバーを募集する場合は「募集する」、募集せずにユニオン名だけを登録する場合は「登録のみ」を選択してください。'],url:['募集記事URL・画像','X・BlablaLink・Discordなどに投稿した募集記事のURLを入力してください。募集画像がある場合は追加できます。画像の登録は任意です。画像を選択した場合は、登録画像を優先表示します。'],period:['管理期間：14日間',''],confirm:['登録内容を確認する','入力内容を確認し、問題がなければ登録へ進んでください。']};

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function choice(name,value,label){return `<button type="button" class="choice ${state[name]===value?'active':''}" data-choice="${name}" data-value="${value}" aria-pressed="${state[name]===value}">${label}</button>`;}

function field(label,id,value,attrs=''){return `<label for="${id}">${label}</label><input class="mock-input" id="${id}" value="${escapeHtml(value)}" ${attrs}>`;}

function summary(){const rows=[['登録タイプ',state.type==='union'?'ユニオン':'指揮官'],[state.type==='union'?'ユニオン名':'指揮官名',state.type==='union'?state.unionName:state.name]];if(state.type==='union'){rows.push(['ユニオンランク',state.rank],['利用方法',state.mode==='recruit'?'募集する':'登録のみ']);}else rows.push(['SLV',state.slv]);if(state.type==='commander'||state.mode==='recruit'){rows.push(['募集記事URL',state.url||'未入力'],['募集画像',state.image?state.image.name:'なし']);}return `<dl class="summary">${rows.map(([a,b])=>`<div><dt>${escapeHtml(a)}</dt><dd>${escapeHtml(b)}</dd></div>`).join('')}</dl>`;}

function panel(key){switch(key){case 'type':return `<div class="demo-label">登録タイプ</div><div class="choice-row">${choice('type','commander','指揮官')}${choice('type','union','ユニオン')}</div>`;case 'name':return field(state.type==='union'?'ユニオン名':'指揮官名','nameInput',state.type==='union'?state.unionName:state.name,'maxlength="40" autocomplete="off" placeholder="名前を入力"');case 'slv':return field('SLV','slvInput',state.slv,'type="number" min="1" max="1200" step="1" placeholder="例：850"');case 'rank':return `<label for="rankInput">ユニオンランク</label><select class="mock-select" id="rankInput">${['チャレンジャー','ダイヤ','プラチナ','ゴールド','シルバー','駆け出しユニオン'].map(v=>`<option ${state.rank===v?'selected':''}>${v}</option>`).join('')}</select>`;case 'usage':return `<div class="demo-label">利用方法</div><div class="choice-row">${choice('mode','recruit','募集する')}${choice('mode','register-only','登録のみ')}</div>`;case 'url':return `<label for="urlInput">募集記事URL</label><input id="urlInput" type="url" class="mock-input" placeholder="https://..." value="${escapeHtml(state.url)}"><label for="imageInput" style="margin-top:16px">募集記事の画像（任意）</label><input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" class="mock-input"><div class="demo-note" id="imageName">${state.image?'選択中：'+escapeHtml(state.image.name):'画像は任意です'}</div>`;case 'period':return '<div class="demo-label">管理期間：14日間</div><div class="demo-note">登録情報の管理期間について</div>';case 'confirm':return summary();}}

function appendParagraph(parent,text,cls){const p=document.createElement('p');if(cls)p.className=cls;p.textContent=text;parent.append(p);}

function render(){const list=steps();index=Math.min(index,list.length-1);const key=list[index];$('stepLabel').textContent=labels[key]==='指揮官名／ユニオン名'?(state.type==='union'?'ユニオン名':'指揮官名'):labels[key];$('stepCount').textContent=`STEP ${index+1} / ${list.length}`;$('trackFill').style.width=`${(index+1)/list.length*100}%`;$('demo').innerHTML=panel(key);$('descriptionTitle').textContent=key==='name'?(state.type==='union'?'ユニオン名':'指揮官名'):info[key][0];const desc=$('descriptionText');desc.replaceChildren();if(info[key][1])appendParagraph(desc,info[key][1]);if(key==='usage'&&state.mode==='register-only'){appendParagraph(desc,'ユニオン名のみを登録します。募集記事は掲載されず、ユニオンリストに名前が表示されます。募集を再開する際は、PASS管理から「募集する」に切り替えられます。');const extra=document.createElement('div');extra.className='extra';extra.innerHTML='<p><strong>「登録のみ」でもDiscord BOTをご利用いただけます！</strong></p><p>NIKKE公式Xのイベント情報や新キャラクター情報、NIKKE公式Discordのログインリマインダー機能に加え、移籍先を探している指揮官の新着情報もDiscordへお届けします。</p><p>継続掲載に便利な期限延長や、募集状況の切り替え機能も搭載しています。</p><p><strong>便利な通知機能が使えるDiscord BOTを、ぜひご利用ください！</strong></p>';desc.append(extra);}if(key==='period'){if(state.type==='union'){appendParagraph(desc,'管理期間は14日間です。');appendParagraph(desc,'PASS管理から、登録情報の変更・削除、募集状況の切り替え、掲載期限の延長ができます。');appendParagraph(desc,'Discord BOTをご利用の場合は、期限通知からPASS不要で掲載期限の延長や募集状況の切り替えもできます。');}else appendParagraph(desc,'掲載期間は14日間です。指揮官の募集は延長できません。');}if(key==='confirm'){const extra=document.createElement('div');extra.className='notice';extra.textContent='登録完了後に8文字のPASSが発行されます。スクリーンショットやメモで必ず保管してください。PASSは登録情報の変更や掲載管理に必要です。';desc.append(extra);appendParagraph(desc,'次へ進むと、サイトの登録確認画面を表示します。','hint');}else appendParagraph(desc,index+1<list.length?`次は「${labels[list[index+1]]}」へ進みます。`:'','hint');$('back').disabled=index===0;$('next').textContent=key==='confirm'?'登録内容を確認する →':'次へ →';const errorNode=$('validationError');errorNode.textContent='';errorNode.hidden=true;if(errorNode.parentElement!==$('guideCard'))$('guideCard').insertBefore(errorNode,$('guideCard').querySelector('.controls'));const bindings={nameInput:state.type==='union'?'unionName':'name',slvInput:'slv',rankInput:'rank',urlInput:'url'};for(const [id,prop] of Object.entries(bindings)){const el=$(id);if(el)el.addEventListener('input',()=>{state[prop]=el.value;const err=$('validationError');if(!err.hidden){err.textContent='';err.hidden=true;}});}if($('imageInput'))$('imageInput').addEventListener('change',e=>{state.image=e.target.files[0]||null;$('imageName').textContent=state.image?'選択中：'+state.image.name:'画像は任意です';});}

// 入力イベントの発火順に依存しないよう、遷移直前に画面の値を同期する。
function syncVisibleInput(){
  const key=steps()[index];
  if(key==='name'){
    const el=$('nameInput');
    if(el)state[state.type==='union'?'unionName':'name']=el.value;
  }else if(key==='slv'){
    const el=$('slvInput');if(el)state.slv=el.value;
  }else if(key==='url'){
    const el=$('urlInput');if(el)state.url=el.value;
  }else if(key==='rank'){
    const el=$('rankInput');if(el)state.rank=el.value;
  }
}
function validate(){syncVisibleInput();const key=steps()[index];let error='';if(key==='name'&&!(state.type==='union'?state.unionName:state.name).trim())error='名前を入力してください。';if(key==='slv'&&(!/^\d+$/.test(state.slv)||Number(state.slv)<1||Number(state.slv)>1200))error='SLVを正しい数値で入力してください。';if(key==='url'&&!state.url.trim())error='募集記事URLを入力してください。';if(key==='url'&&state.url.trim()){try{const url=new URL(state.url);if(!['http:','https:'].includes(url.protocol))throw Error();}catch{error='URLは https:// から始まる正しい形式で入力してください。';}}if(key==='url'&&state.image&&(!['image/jpeg','image/png','image/webp'].includes(state.image.type)||state.image.size>20*1024*1024))error='画像はJPG・PNG・WebP形式で20MB以下にしてください。';if(error){const node=$('validationError');node.textContent=error;node.hidden=false;return false;}return true;}
// 選択ボタンは再描画で作り直されるため、親要素でクリックを受け取る。
// 登録タイプは何度でも切り替え可能。変更時はSTEP 1のまま再描画する。
$('demo').addEventListener('click',event=>{
  const button=event.target.closest('button[data-choice]');
  if(!button||!$('demo').contains(button))return;
  const property=button.dataset.choice;
  const value=button.dataset.value;
  if(!['type','mode'].includes(property))return;
  if(property==='type'&&!['commander','union'].includes(value))return;
  if(property==='mode'&&!['recruit','register-only'].includes(value))return;
  if(state[property]===value)return;
  state[property]=value;
  render();
});
$('back').addEventListener('click',()=>{if(index>0){index--;render();}});
$('next').addEventListener('click',()=>{if(!validate())return;if(index<steps().length-1){index++;render();return;}handoffToRegistration();});
$('closeGuide').addEventListener('click',()=>{if(state.name||state.unionName||state.slv||state.url||state.image){$('closeDialog').showModal();}else location.href='../index.html#registerPage';});$('cancelClose').addEventListener('click',()=>$('closeDialog').close());$('confirmClose').addEventListener('click',()=>{sessionStorage.removeItem('unionMatchGuideDraft');location.href='../index.html#registerPage';});render();
// プレビューの「修正する」から戻った場合は入力済み状態を復元する。
try {
  const raw=sessionStorage.getItem('unionMatchGuideReturn');
  if(raw){
    sessionStorage.removeItem('unionMatchGuideReturn');
    const draft=JSON.parse(raw);
    for(const key of ['type','mode','name','unionName','slv','rank','url']){
      if(typeof draft[key]==='string')state[key]=draft[key];
    }
    index=steps().length-1;
    render();
  }
} catch(error){console.warn('ガイド復元失敗',error);}

// FileはsessionStorageに格納できないため、同一オリジンのIndexedDBで一度だけ受け渡す。
function openGuideTransferDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('um-guide-transfer',1);req.onupgradeneeded=()=>req.result.createObjectStore('handoff');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function handoffToRegistration(){
  const next=$('next');next.disabled=true;
  try{
    const db=state.image ? await openGuideTransferDB() : null;
    if(db) await new Promise((resolve,reject)=>{const tx=db.transaction('handoff','readwrite');tx.objectStore('handoff').put(state.image||null,'image');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    if(db) db.close();
    sessionStorage.setItem('unionMatchGuideDraft',JSON.stringify({type:state.type,mode:state.mode,name:state.name,unionName:state.unionName,slv:state.slv,rank:state.rank,url:state.url,hasImage:Boolean(state.image),createdAt:Date.now()}));
    location.href='../index.html#registerPage';
  }catch(error){$('validationError').textContent='登録画面への引き継ぎに失敗しました。もう一度お試しください。';$('validationError').hidden=false;next.disabled=false;console.error(error);}
}
