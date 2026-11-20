/* Single shared header, drawer and footer for all public pages. */
(() => {
  'use strict';
  const host = document.getElementById('umSharedNavigation');
  if (!host) return;
  const root = new URL(host.dataset.umNavRoot || './', document.baseURI);
  const link = path => new URL(path, root).href;
  const index = host.dataset.umPage === 'index';
  const title = host.dataset.umTitle || '';
  const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const icons = [svg('<path d="m3 10 9-7 9 7v10H3z"/>'),svg('<path d="M12 5v14M5 12h14"/>'),svg('<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21m-4 0v3m3-3v3"/>'),svg('<path d="M4 6h16M4 12h16M4 18h16"/>')];
  const brand = index ? `<button id="videoTopSwitch" class="um-shared-brand" type="button" aria-label="動画トップへ戻る"><img src="${link('assets/union-match-logo-white.png')}" alt="UNION MATCH"></button>` : `<a class="um-shared-brand" href="${link('index.html#videoHero')}" aria-label="UNION MATCH ホーム">${title}</a>`;
  const actions = index ? [
    ['top','ホーム'],['commander','指揮官を見る'],['union','ユニオンを見る'],['register','募集登録'],['manage','PASS管理']
  ].map(([action,label])=>`<button type="button" data-menu-action="${action}">${label}</button>`).join('') : [
    ['index.html#videoHero','ホーム'],['index.html?view=commander#listPage','指揮官を見る'],['index.html?view=union#listPage','ユニオンを見る'],['index.html#registerPage','募集登録'],['index.html#managePage','PASS管理']
  ].map(([href,label])=>`<a href="${link(href)}">${label}</a>`).join('');
  host.innerHTML = `<header class="um-shared-header ${index?'um-index-header':''}">${brand}<div class="um-shared-actions"><button class="um-notification-bell" type="button" aria-label="プッシュ通知設定を開く" title="プッシュ通知設定"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="um-bell-light" aria-hidden="true"></span></button><button id="siteMenuButton" class="um-shared-menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="siteMenuDrawer"><span></span><span></span><span></span></button></div></header><div id="siteMenuBackdrop" class="um-shared-backdrop" hidden></div><aside id="siteMenuDrawer" class="um-shared-drawer" aria-hidden="true"><div class="um-shared-drawer-head"><span>MENU</span><button id="siteMenuClose" type="button" aria-label="メニューを閉じる">×</button></div>${actions}<button type="button" class="um-notification-menu-entry" data-um-notification-open>プッシュ通知設定</button><a href="${link('html/union-list.html')}">ユニオンリスト</a><a href="${link('bot.html')}">Discord BOT</a><a href="${link('creators.html')}">応援クリエイター</a><p>このサイトはSHIFT UPが提供する「勝利の女神：NIKKE」の公式サイトではありません。ファンサイトです。</p></aside><nav id="bottomNav" class="um-shared-footer ${index?'bottom-nav':''}" aria-label="フッターメニュー">${index?`<button class="um-footer-item nav-btn" type="button" data-um-home>${icons[0]}<span>ホーム</span></button><button class="um-footer-item nav-btn" type="button" data-page="register">${icons[1]}<span>登録</span></button><button class="um-footer-item nav-btn" type="button" data-page="manage">${icons[2]}<span>PASS</span></button>`:`<a class="um-footer-item" href="${link('index.html#videoHero')}">${icons[0]}<span>ホーム</span></a><a class="um-footer-item" href="${link('index.html#registerPage')}">${icons[1]}<span>登録</span></a><a class="um-footer-item" href="${link('index.html#managePage')}">${icons[2]}<span>PASS</span></a>`}<button class="um-footer-item" type="button" data-um-menu-open>${icons[3]}<span>メニュー</span></button></nav>`;
  const drawer = host.querySelector('#siteMenuDrawer');
  const backdrop = host.querySelector('#siteMenuBackdrop');
  const button = host.querySelector('#siteMenuButton');
  const setOpen = open => {
    document.body.classList.toggle('menu-open',open);
    drawer.setAttribute('aria-hidden',String(!open));
    button.setAttribute('aria-expanded',String(open));
    backdrop.hidden=!open;
  };
  window.closeSiteMenu=()=>setOpen(false);
  window.openSiteMenu=()=>setOpen(true);
  button.addEventListener('click',()=>setOpen(!document.body.classList.contains('menu-open')));
  host.querySelector('[data-um-menu-open]').addEventListener('click',()=>setOpen(true));
  host.querySelector('#siteMenuClose').addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false));
  drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  if(index){
    host.querySelector('[data-um-home]').addEventListener('click',()=>host.querySelector('#videoTopSwitch').click());
  }
})();
