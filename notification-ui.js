/* UNION MATCH shared notification UI. One implementation for all pages. */
(() => {
  'use strict';
  // Resolve assets relative to this script (works on / and /html/ pages).
  const PUBLIC_VAPID_KEY = 'BD36SVKFXwZF-4OwJUpin8hnz6Fx-Cqhe6kmx4QUXUEn4cXWIGkvXk97Kd5gHLqrzkKso8QOHCEHWAhwSZCA61I';
  const SETTINGS_API = 'https://igoekrvpgnjberppiawf.supabase.co/functions/v1/web-push-settings/settings';
  const script = document.currentScript;
  const base = new URL('.', script?.src || document.baseURI);
  function ensureLink(rel, href, attrs = {}) {
    if (document.head.querySelector(`link[rel="${rel}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = new URL(href, base).href;
    for (const [name, value] of Object.entries(attrs)) link.setAttribute(name, value);
    document.head.appendChild(link);
  }
  ensureLink('manifest', 'manifest.webmanifest');
  ensureLink('apple-touch-icon', 'apple-touch-icon.png');
  function guidance() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'このブラウザはプッシュ通知に対応していません。対応ブラウザで開いてください。';
    }
    if (isIOS && !standalone) {
      return 'iPhone・iPadでは、共有メニューから「ホーム画面に追加」し、追加したUNION MATCHのアイコンから開いてください。その後、通知ベルから許可できます。';
    }
    if (Notification.permission === 'denied') {
      return 'ブラウザで通知がブロックされています。端末の設定からUNION MATCHの通知を許可してください。';
    }
    return '通知の登録にはブラウザの許可が必要です。保存すると、この端末の通知設定が登録されます。';
  }
  // Registers only push/click listeners; no fetch interception or caching.
  if (isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('um-sw.js', base).href, { scope: base.pathname })
      .catch(err => console.warn('[UM push] Service Worker registration failed:', err?.message || err));
  }
  function decodeVapid(value) {
    const text = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
  }
  async function postSettings(subscription, action, notifyX, notifySite) {
    const response = await fetch(SETTINGS_API, {
      method: 'POST', mode: 'cors', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({action, subscription: subscription.toJSON(), notify_x: notifyX, notify_site: notifySite, notify_expiry: false})
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || !data.saved) throw new Error(data.error || ('HTTP_' + response.status));
    return data;
  }
  function init() {
    const siteMenu = document.getElementById('siteMenuButton');
    document.querySelectorAll('[data-um-menu-open]').forEach(button => button.addEventListener('click', () => siteMenu?.click()));
    document.querySelector('[data-um-home]')?.addEventListener('click', () => document.getElementById('videoTopSwitch')?.click());
    const dialog = document.createElement('div');
    dialog.className = 'um-notification-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'プッシュ通知設定');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = `<div class="um-notification-panel">
      <button type="button" class="um-close" aria-label="閉じる">×</button>
      <h2>NOTIFICATIONS</h2><div class="um-subtitle">プッシュ通知設定</div>
      <label class="um-row"><span>Xの新着指揮官通知</span><input id="umX" type="checkbox"></label>
      <label class="um-row"><span>サイト登録の新着指揮官通知<small style="display:block;color:#777">毎日21:00に通知</small></span><input id="umSite" type="checkbox"></label>
      <label class="um-row"><span>14日間の掲載期限通知<small style="display:block;color:#777">期限48時間前に通知</small></span><input id="umExpiry" type="checkbox"></label>
      <div class="um-pass-wrap" hidden><label for="umPass">登録時のPASS（初回連携のみ）</label><input id="umPass" type="password" autocomplete="off" placeholder="PASSを入力"></div>
      <button type="button" class="um-save">通知設定を保存</button>
      <div class="um-status" role="status"></div>
      <div class="um-hint"></div>
    </div>`;
    document.body.appendChild(dialog);
    const hint = dialog.querySelector('.um-hint');
    const status = dialog.querySelector('.um-status');
    const save = dialog.querySelector('.um-save');
    const xToggle = dialog.querySelector('#umX');
    const siteToggle = dialog.querySelector('#umSite');
    const expiryToggle = dialog.querySelector('#umExpiry');
    const expiryWrap = dialog.querySelector('.um-pass-wrap');
    expiryToggle.disabled = true;
    expiryToggle.title = 'PASS本人確認機能の準備中です';
    expiryWrap.hidden = true;
    async function refreshLocalState() {
      if (!('serviceWorker' in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration(base.href);
        const subscription = await reg?.pushManager?.getSubscription();
        // Avoid showing unsaved preferences as saved. Local state is only a hint, never proof.
        if (!subscription) status.textContent = 'この端末は未登録です。';
      } catch (_) {}
    }
    const close = () => { dialog.dataset.open = 'false'; };
    const open = () => {
      if (document.body.classList.contains('menu-open')) document.getElementById('siteMenuClose')?.click();
      hint.textContent = guidance();
      dialog.dataset.open = 'true';
      refreshLocalState();
    };
    document.querySelectorAll('.um-notification-bell,[data-um-notification-open]')
      .forEach(button => button.addEventListener('click', open));
    dialog.querySelector('.um-close').addEventListener('click', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    save.addEventListener('click', async () => {
      if (save.disabled) return;
      const notifyX = xToggle.checked;
      const notifySite = siteToggle.checked;
      if (expiryToggle.checked) {
        status.textContent = '期限通知はPASS本人確認の準備中です。現在は登録できません。';
        return;
      }
      if (!isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        status.textContent = 'この環境ではプッシュ通知を登録できません。' ;
        return;
      }
      const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
      if (ios && !standalone) {
        status.textContent = 'iPhone・iPadではホーム画面に追加したアイコンから開いてください。';
        return;
      }
      save.disabled = true;
      status.textContent = '端末の通知設定を確認中…';
      try {
        const reg = await navigator.serviceWorker.register(new URL('um-sw.js', base).href, {scope: base.pathname});
        const current = await reg.pushManager.getSubscription();
        if (!notifyX && !notifySite) {
          if (!current) {
            status.textContent = 'この端末に登録済みの通知はありません。';
            return;
          }
          await postSettings(current, 'disable', false, false);
          // After the server confirms disable, remove browser registration.
          try { await current.unsubscribe(); } catch (_) {}
          status.textContent = 'この端末の通知をすべてOFFにしました。';
          return;
        }
        if (Notification.permission === 'denied') throw new Error('通知がブロックされています。端末の設定から通知を許可してください。');
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') throw new Error('通知が許可されませんでした。設定は保存していません。');
        }
        const subscription = current || await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:decodeVapid(PUBLIC_VAPID_KEY)});
        await postSettings(subscription, 'save', notifyX, notifySite);
        status.textContent = '保存しました。この端末の通知設定を更新しました。';
      } catch (error) {
        console.warn('[UM push] settings failed:', error);
        status.textContent = '保存できませんでした：' + (error?.message || '通信エラー');
      } finally {
        save.disabled = false;
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && dialog.dataset.open === 'true') close();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
