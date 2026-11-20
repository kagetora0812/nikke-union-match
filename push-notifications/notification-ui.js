/* UNION MATCH shared notification UI. One implementation for all pages. */
(() => {
  'use strict';
  const PUBLIC_VAPID_KEY = 'BD36SVKFXwZF-4OwJUpin8hnz6Fx-Cqhe6kmx4QUXUEn4cXWIGkvXk97Kd5gHLqrzkKso8QOHCEHWAhwSZCA61I';
  const SETTINGS_API = 'https://igoekrvpgnjberppiawf.supabase.co/functions/v1/web-push-settings/settings';
  const UNION_API = 'https://igoekrvpgnjberppiawf.supabase.co/functions/v1/web-push-union-control';
  const TOKEN_KEY = 'um_webpush_union_token_v1';
  const script = document.currentScript;
  const base = new URL('../', script?.src || document.baseURI);
  // 端末別の月次集計は全公開ページ共通。ADMIN画面は対象外。
  if (!/(?:^|\/)creator-admin\.html$/i.test(location.pathname)) {
    const deviceAnalytics = document.createElement('script');
    deviceAnalytics.src = new URL('site-device-analytics.js?v=20261028-1', base).href;
    deviceAnalytics.async = true;
    document.head.appendChild(deviceAnalytics);
  }
  function ensureLink(rel, href, attrs = {}) {
    if (document.head.querySelector(`link[rel="${rel}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = new URL(href, base).href;
    for (const [name, value] of Object.entries(attrs)) link.setAttribute(name, value);
    document.head.appendChild(link);
  }
  ensureLink('manifest', 'manifest.webmanifest');
  ensureLink('apple-touch-icon', 'push-notifications/icons/apple-touch-icon.png');
  function guidance() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'ご利用のブラウザはプッシュ通知に対応していません。Chrome・Edge・Safariなどの対応ブラウザをご利用ください。';
    if (isIOS && !standalone) return '通知を利用するには、UNION MATCHをホーム画面に追加してください。共有メニューから「ホーム画面に追加」を選び、追加したアイコンから通知を設定してください。';
    if (Notification.permission === 'denied') return '通知がブロックされています。ブラウザの設定から通知を許可してください。';
    return '通知を受け取るには、ブラウザの通知許可が必要です。「通知設定を保存」を押して、通知を許可してください。';
  }
  if (isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('um-sw.js', base).href, {scope:base.pathname})
      .catch(error => console.warn('[UM push] Service Worker registration failed:', error?.message || error));
  }
  function decodeVapid(value) {
    const text = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
  }
  async function postSettings(subscription, action, notifyX, notifySite) {
    const response = await fetch(SETTINGS_API, {method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,subscription:subscription.toJSON(),notify_x:notifyX,notify_site:notifySite,notify_expiry:false})});
    let data={}; try {data=await response.json();}catch (_) {}
    if (!response.ok || (action !== 'get' && !data.saved)) throw new Error(data.error || ('HTTP_'+response.status));
    return data;
  }
  async function postUnion(subscription, action, extras={}) {
    const response=await fetch(UNION_API,{method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,subscription:subscription.toJSON(),...extras})});
    let data={};try{data=await response.json();}catch(_){}
    if(!response.ok)throw new Error(data.error||('HTTP_'+response.status));
    return data;
  }
  function freshToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
  function init() {
    // Menu and Home controls belong to each page navigation, not this notification UI.
    const dialog=document.createElement('div');
    dialog.className='um-notification-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','プッシュ通知設定');dialog.setAttribute('aria-modal','true');
    dialog.innerHTML=`<div class="um-notification-panel">
      <div class="um-notification-heading"><button type="button" class="um-close" aria-label="閉じる">× 閉じる</button><div class="um-notification-titles"><span class="um-notification-eyebrow">NOTIFICATIONS</span><h2>プッシュ通知設定</h2></div></div>
      <label class="um-row"><span>Xの新着指揮官通知</span><input id="umX" type="checkbox"></label>
      <label class="um-row"><span>サイト登録の新着指揮官通知<small>毎日21:00に通知</small></span><input id="umSite" type="checkbox"></label>
      <label class="um-row"><span>14日間の掲載期限通知<small>期限48時間前に通知</small></span><input id="umExpiry" type="checkbox"></label>
      <div class="um-pass-wrap" hidden><label for="umPass">登録時のPASS（初回連携のみ）</label><input id="umPass" type="password" autocomplete="off" maxlength="8" placeholder="8文字のPASSを入力"><small>初回のみPASS認証で、この端末を登録します。認証後は、この端末からPASS入力なしで登録情報を管理できます。期限通知をOFFにすると、PASS不要の管理機能も解除されます。</small></div>
      <button type="button" class="um-save">通知設定を保存</button>
      <div class="um-status" role="status"></div><div class="um-hint"></div><div class="um-pass-status" style="color:#168bd2;font-size:11px;line-height:1.5;font-weight:700;display:none" aria-live="polite"></div>
    </div>`;
    document.body.appendChild(dialog);
    const hint=dialog.querySelector('.um-hint'),status=dialog.querySelector('.um-status'),save=dialog.querySelector('.um-save');
    const passStatus=dialog.querySelector('.um-pass-status');
    const setPassStatus=authorized=>{passStatus.textContent=authorized?'✓ PASS連携済み（PASS入力不要）':'';passStatus.style.display=authorized?'block':'none';};
    let restoreSequence=0;
    const xToggle=dialog.querySelector('#umX'),siteToggle=dialog.querySelector('#umSite'),expiryToggle=dialog.querySelector('#umExpiry');
    const expiryWrap=dialog.querySelector('.um-pass-wrap'),passInput=dialog.querySelector('#umPass');
    const bells=document.querySelectorAll('.um-notification-bell');
    let wasExpiryOn=false;
    let serverExpiryOn=false;
    const setBell=on=>bells.forEach(b=>{b.dataset.status=on?'on':'off';});
    const syncPass=()=>{expiryWrap.hidden=!expiryToggle.checked || wasExpiryOn;};
    // 通知の「許可」とサイトの「配信ON」の両方を満たす場合だけ正常表示。
    function showNotificationState(on) {
      const permitted = 'Notification' in window && Notification.permission === 'granted';
      const active = permitted && on;
      hint.textContent = active ? '✓ 通知は正常に設定されています。'
        : permitted && !on ? '通知はOFFです。'
        : guidance();
      hint.style.color = active ? '#168bd2' : '';
      hint.style.fontWeight = active ? '700' : '';
    }
    expiryToggle.addEventListener('change',syncPass);
    async function refreshLocalState(){
      const sequence=++restoreSequence;
      setPassStatus(false);
      if(!('serviceWorker' in navigator)){setBell(false);showNotificationState(false);return;}
      try{
        const reg=await navigator.serviceWorker.getRegistration(base.href);
        const subscription=await reg?.pushManager?.getSubscription();
        if(!subscription){
          // If a browser silently removes this PushSubscription, do not keep
          // treating a stale PASS session from this device as authorized.
          localStorage.removeItem(TOKEN_KEY);
          xToggle.checked=false;siteToggle.checked=false;expiryToggle.checked=false;wasExpiryOn=false;serverExpiryOn=false;
          syncPass();setBell(false);showNotificationState(false);status.textContent='';return;
        }
        if('Notification' in window && Notification.permission!=='granted'){
          // No other device is touched: endpoints identify this subscription.
          // Failure means retry on the next visit; never mark the server clean
          // when the request did not succeed.
          try {
            await postUnion(subscription,'revoke');
            await postSettings(subscription,'disable',false,false);
            localStorage.removeItem(TOKEN_KEY);
          } catch(error) { console.warn('[UM push] revocation sync pending:',error?.message||error); }
          xToggle.checked=false;siteToggle.checked=false;expiryToggle.checked=false;wasExpiryOn=false;serverExpiryOn=false;
          syncPass();setBell(false);showNotificationState(false);status.textContent='';return;
        }
        const saved=await postSettings(subscription,'get',false,false);
        if(saved.found===false || saved.enabled!==true){
          // A disabled or missing server-side subscription never authorizes
          // an old local PASS token. Do not revive it from localStorage.
          localStorage.removeItem(TOKEN_KEY);
        }
        // X/site and union-expiry are separate server APIs.  An expiry-only
        // subscription can be active even if the X/site settings say OFF.
        const newsEnabled=saved.enabled===true;
        const xOn=newsEnabled&&saved.notify_x===true;
        const siteOn=newsEnabled&&saved.notify_site===true;
        const registeredExpiry=saved.enabled===true&&saved.notify_expiry===true;
        let passAuthorized=false;
        let verificationPending=false;
        const token=localStorage.getItem(TOKEN_KEY);
        if(token && saved.found!==false && saved.enabled===true && Notification.permission==='granted'){
          try{
            const verification=await postUnion(subscription,'check',{session_token:token});
            passAuthorized=verification.authorized===true;
          }catch(error){
            const code=String(error?.message||'');
            if(['DEVICE_NOT_VERIFIED','TOKEN_REQUIRED','SUBSCRIPTION_NOT_OWNED','MEMBERSHIP_EXPIRED'].some(x=>code.includes(x))) {
              localStorage.removeItem(TOKEN_KEY);
            } else verificationPending=true; // do not delete credentials after a network failure
            console.warn('[UM push] union status check failed:',code);
          }
        }
        if(sequence!==restoreSequence)return;
        serverExpiryOn=registeredExpiry;
        xToggle.checked=xOn;siteToggle.checked=siteOn;
        expiryToggle.checked=registeredExpiry;wasExpiryOn=passAuthorized;
        syncPass();setPassStatus(passAuthorized);
        const on=xOn||siteOn||registeredExpiry;
        setBell(Notification.permission==='granted'&&on);
        showNotificationState(on);
        status.textContent=registeredExpiry&&!passAuthorized
          ? (verificationPending?'期限通知の連携を確認できません。通信状態をご確認ください。':'期限通知のPASS連携がこの端末で確認できません。必要ならチェックを入れ、PASSで再連携してください。')
          : '';
      }catch(error){console.warn('[UM push] restore failed:',error);status.textContent='設定の読み込みに失敗しました。';}
    }
    refreshLocalState();
    const close=()=>{dialog.dataset.open='false';};
    const open=()=>{if(document.body.classList.contains('menu-open'))document.getElementById('siteMenuClose')?.click();setPassStatus(false);showNotificationState(false);dialog.dataset.open='true';refreshLocalState();};
    document.addEventListener('click',event=>{if(event.target.closest('.um-notification-bell,[data-um-notification-open]'))open();});
    window.addEventListener('pageshow',refreshLocalState);
    dialog.querySelector('.um-close').addEventListener('click',close);
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    save.addEventListener('click',async()=>{
      if(save.disabled)return;
      const notifyX=xToggle.checked,notifySite=siteToggle.checked,notifyExpiry=expiryToggle.checked;
      if(!isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){status.textContent='お使いの環境では通知を設定できません。ブラウザの通知対応状況をご確認ください。';return;}
      const ios=/iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
      if(ios&&!(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true)){status.textContent='通知を利用するには、UNION MATCHをホーム画面に追加してください。共有メニューから「ホーム画面に追加」を選び、追加したアイコンから通知を設定してください。';return;}
      if(notifyExpiry&&!wasExpiryOn&&!/^[A-HJ-NP-Z2-9]{8}$/i.test(passInput.value.trim())){status.textContent='期限通知には初回のみ8文字のPASSが必要です。';return;}
      save.disabled=true;status.textContent='端末の通知設定を確認中…';
      try{
        const reg=await navigator.serviceWorker.register(new URL('um-sw.js',base).href,{scope:base.pathname});
        const current=await reg.pushManager.getSubscription();
        if(!notifyX&&!notifySite&&!notifyExpiry){
          if(!current){localStorage.removeItem(TOKEN_KEY);setBell(false);status.textContent='この端末に登録済みの通知はありません。';return;}
          // Always revoke any leftover PASS session, even if the local UI has
          // not yet restored the previous expiry toggle.
          await postUnion(current,'revoke');
          await postSettings(current,'disable',false,false);
          try{await current.unsubscribe();}catch(_){}
          localStorage.removeItem(TOKEN_KEY);wasExpiryOn=false;setBell(false);showNotificationState(false);setPassStatus(false);status.textContent='';return;
        }
        if(Notification.permission==='denied')throw new Error('通知がブロックされています。ブラウザの設定から通知を許可してください。');
        if(Notification.permission!=='granted'){const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('通知が許可されませんでした。設定は保存していません。');}
        const subscription=current||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(PUBLIC_VAPID_KEY)});
        if(serverExpiryOn&&!notifyExpiry){await postUnion(subscription,'revoke');localStorage.removeItem(TOKEN_KEY);wasExpiryOn=false;serverExpiryOn=false;}
        // Existing settings API handles X/site; it intentionally does not authorize expiry.
        await postSettings(subscription,'save',notifyX,notifySite);
        if(notifyExpiry){
          const token=wasExpiryOn?localStorage.getItem(TOKEN_KEY):freshToken();
          if(!token)throw new Error('認証情報がありません。期限通知をOFFにして、PASSから再設定してください。');
          if(!wasExpiryOn){await postUnion(subscription,'bind',{pass:passInput.value.trim(),session_token:token});localStorage.setItem(TOKEN_KEY,token);}
          else {const verification=await postUnion(subscription,'check',{session_token:token});if(verification.authorized!==true)throw new Error('掲載期限通知の連携を確認できませんでした。PASSから再設定してください。');}
          wasExpiryOn=true;serverExpiryOn=true;passInput.value='';
        }
        syncPass();setBell(true);showNotificationState(true);setPassStatus(notifyExpiry && wasExpiryOn);status.textContent='';
      }catch(error){console.warn('[UM push] settings failed:',error);status.textContent='保存できませんでした：'+(error?.message||'通信エラー');await refreshLocalState();}
      finally{save.disabled=false;}
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.dataset.open==='true')close();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
