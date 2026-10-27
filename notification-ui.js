/* UNION MATCH shared notification UI. One implementation for all pages. */
(() => {
  'use strict';
  // Resolve assets relative to this script (works on / and /html/ pages).
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
    return '通知の登録にはブラウザの許可が必要です。通知サービスの接続が完了するまで設定は保存されません。';
  }
  // Registers only push/click listeners; no fetch interception or caching.
  if (isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('um-sw.js', base).href, { scope: base.pathname })
      .catch(err => console.warn('[UM push] Service Worker registration failed:', err?.message || err));
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
    const close = () => { dialog.dataset.open = 'false'; };
    const open = () => {
      if (document.body.classList.contains('menu-open')) document.getElementById('siteMenuClose')?.click();
      hint.textContent = guidance();
      dialog.dataset.open = 'true';
    };
    document.querySelectorAll('.um-notification-bell,[data-um-notification-open]')
      .forEach(button => button.addEventListener('click', open));
    dialog.querySelector('.um-close').addEventListener('click', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    dialog.querySelector('#umExpiry').addEventListener('change', event => {
      dialog.querySelector('.um-pass-wrap').hidden = !event.target.checked;
    });
    dialog.querySelector('.um-save').addEventListener('click', () => {
      dialog.querySelector('.um-status').textContent = '通知サーバー未接続のため、設定は保存されていません。';
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && dialog.dataset.open === 'true') close();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
