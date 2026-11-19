/* Shared navigation for standalone pages; INDEX keeps its original footer scroll behavior. */
(() => {
  'use strict';
  const host = document.getElementById('umSharedNavigation');
  if (!host) return;
  const root = new URL(host.dataset.umNavRoot || './', document.baseURI);
  const link = path => new URL(path, root).href;
  const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons = [svg('<path d="m3 10 9-7 9 7v10H3z"/>'),svg('<path d="M12 5v14M5 12h14"/>'),svg('<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21m-4 0v3m3-3v3"/>'),svg('<path d="M4 6h16M4 12h16M4 18h16"/>')];
  host.innerHTML = `<header class="um-shared-header"><a class="um-shared-brand" href="${link('index.html#videoHero')}" aria-label="UNION MATCH ホーム"><img src="${link('assets/union-match-logo-white.png')}" alt="UNION MATCH"></a><div class="um-shared-actions"><button class="um-notification-bell" type="button" aria-label="プッシュ通知設定を開く" title="プッシュ通知設定"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="um-bell-light" aria-hidden="true"></span></button><button class="um-shared-menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="umSharedDrawer"><span></span><span></span><span></span></button></div></header><div class="um-shared-backdrop" hidden></div><aside class="um-shared-drawer" id="umSharedDrawer" aria-hidden="true"><div class="um-shared-drawer-head"><b>MENU</b><button type="button" class="um-shared-close" aria-label="メニューを閉じる">×</button></div><a href="${link('index.html#videoHero')}">ホーム</a><a href="${link('index.html?view=commander#listPage')}">指揮官を見る</a><a href="${link('index.html?view=union#listPage')}">ユニオンを見る</a><a href="${link('index.html#registerPage')}">募集登録</a><a href="${link('index.html#managePage')}">PASS管理</a><button type="button" data-um-notification-open>プッシュ通知設定</button><a href="${link('html/union-list.html')}">ユニオンリスト</a><a href="${link('bot.html')}">Discord BOT</a><a href="${link('creators.html')}">応援クリエイター</a><p>このサイトはSHIFT UPが提供する「勝利の女神：NIKKE」の公式サイトではありません。ファンサイトです。</p></aside><nav class="um-shared-footer" aria-label="フッターメニュー"><a href="${link('index.html#videoHero')}">${icons[0]}<span>ホーム</span></a><a href="${link('index.html#registerPage')}">${icons[1]}<span>登録</span></a><a href="${link('index.html#managePage')}">${icons[2]}<span>PASS</span></a><button type="button" data-um-shared-menu-open>${icons[3]}<span>メニュー</span></button></nav>`;
  const drawer = host.querySelector('.um-shared-drawer');
  const backdrop = host.querySelector('.um-shared-backdrop');
  const toggle = host.querySelector('.um-shared-menu-toggle');
  const setOpen = open => {drawer.classList.toggle('open',open);backdrop.hidden=!open;drawer.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));document.body.classList.toggle('um-shared-menu-open',open);};
  toggle.addEventListener('click',()=>setOpen(!drawer.classList.contains('open')));
  host.querySelector('[data-um-shared-menu-open]').addEventListener('click',()=>setOpen(true));
  host.querySelector('.um-shared-close').addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false));
  drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  // notification-ui.js binds at DOMContentLoaded; shared buttons are already inserted by deferred script.
})();
