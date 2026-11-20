/* Public-site navigation: a single template and one menu state controller. */
(() => {
  'use strict';
  const host = document.getElementById('umSharedNavigation');
  if (!host || host.dataset.umNavReady === 'true') return;
  host.dataset.umNavReady = 'true';

  const base = new URL(host.dataset.umNavRoot || './', document.baseURI);
  const href = path => new URL(path, base).href;
  const isIndex = host.dataset.umPage === 'index';
  const svg = content => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
  const icons = [
    svg('<path d="m3 10 9-7 9 7v10H3z"/>'),
    svg('<path d="M12 5v14M5 12h14"/>'),
    svg('<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21m-4 0v3m3-3v3"/>'),
    svg('<path d="M4 6h16M4 12h16M4 18h16"/>')
  ];
  const logo = `<img src="${href('assets/union-match-logo-white.png')}" alt="UNION MATCH">`;
  const brand = isIndex
    ? `<button id="videoTopSwitch" class="um-shared-brand" type="button" aria-label="動画トップへ戻る" title="TOP">${logo}</button>`
    : `<a class="um-shared-brand" href="${href('index.html#videoHero')}" aria-label="UNION MATCH TOPへ戻る">${logo}</a>`;
  const navActions = isIndex
    ? [['top','ホーム'],['commander','指揮官を見る'],['union','ユニオンを見る'],['register','募集登録'],['manage','PASS管理']]
      .map(([action,label]) => `<button type="button" data-menu-action="${action}">${label}</button>`).join('')
    : [['index.html#videoHero','ホーム'],['index.html?view=commander#listPage','指揮官を見る'],
       ['index.html?view=union#listPage','ユニオンを見る'],['index.html#registerPage','募集登録'],
       ['index.html#managePage','PASS管理']]
      .map(([path,label]) => `<a href="${href(path)}">${label}</a>`).join('');
  const item = (type,attr,icon,label) => `<${type} class="um-footer-item" ${attr}>${icon}<span>${label}</span></${type}>`;
  const footer = isIndex
    ? item('button','type="button" data-um-home',icons[0],'ホーム')
      + item('button','type="button" data-page="register"',icons[1],'登録')
      + item('button','type="button" data-page="manage"',icons[2],'PASS')
    : item('a',`href="${href('index.html#videoHero')}"`,icons[0],'ホーム')
      + item('a',`href="${href('index.html#registerPage')}"`,icons[1],'登録')
      + item('a',`href="${href('index.html#managePage')}"`,icons[2],'PASS');

  host.innerHTML = `
    <header class="um-shared-header">
      ${brand}
      <div class="um-shared-actions">
        <button class="um-notification-bell" type="button" aria-label="プッシュ通知設定を開く" title="プッシュ通知設定"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="um-bell-light" aria-hidden="true"></span></button>
        <button id="siteMenuButton" class="um-shared-menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="siteMenuDrawer"><span></span><span></span><span></span></button>
      </div>
    </header>
    <div id="siteMenuBackdrop" class="um-shared-backdrop" hidden></div>
    <aside id="siteMenuDrawer" class="um-shared-drawer" aria-hidden="true">
      <div class="um-shared-drawer-head"><span>MENU</span><button id="siteMenuClose" type="button" aria-label="メニューを閉じる">×</button></div>
      ${navActions}
      <button type="button" class="um-notification-menu-entry" data-um-notification-open>プッシュ通知設定</button>
      <a href="${href('html/union-list.html')}">ユニオンリスト</a>
      <a href="${href(isIndex ? 'bot.html?um_source=index' : 'bot.html')}">Discord BOT</a>
      <a href="${href('creators.html')}">応援クリエイター</a>
      <div class="um-shared-disclaimer">このサイトはSHIFT UPが提供する「勝利の女神：NIKKE」の公式サイトではありません。<br>ファンサイトです。</div>
    </aside>
    <nav id="bottomNav" class="um-shared-footer${isIndex ? ' um-index-footer' : ''}" aria-label="フッターメニュー">
      ${footer}
      ${item('button','type="button" data-um-menu-open',icons[3],'メニュー')}
    </nav>`;

  const drawer = host.querySelector('#siteMenuDrawer');
  const backdrop = host.querySelector('#siteMenuBackdrop');
  const toggle = host.querySelector('#siteMenuButton');
  const setMenuOpen = open => {
    document.body.classList.toggle('menu-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    drawer.setAttribute('aria-hidden',String(!open));
    backdrop.hidden = !open;
  };
  window.closeSiteMenu = () => setMenuOpen(false);
  window.openSiteMenu = () => setMenuOpen(true);
  toggle.addEventListener('click', () => setMenuOpen(!document.body.classList.contains('menu-open')));
  host.querySelector('[data-um-menu-open]').addEventListener('click', () => setMenuOpen(!document.body.classList.contains('menu-open')));
  host.querySelector('#siteMenuClose').addEventListener('click', window.closeSiteMenu);
  backdrop.addEventListener('click', window.closeSiteMenu);
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', window.closeSiteMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') window.closeSiteMenu(); });
  // INDEX's existing app.js exclusively owns video-top, page selection and footer visibility.
})();
