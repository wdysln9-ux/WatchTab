// ==UserScript==
// @name         AniList Watch Tab
// @namespace    https://github.com/wdysln9-ux/WatchTab
// @version      0.3.0
// @description  Adds a native-looking Watch tab to AniList anime pages.
// @updateURL    https://raw.githubusercontent.com/wdysln9-ux/WatchTab/main/WatchTab.user.js
// @downloadURL  https://raw.githubusercontent.com/wdysln9-ux/WatchTab/main/WatchTab.user.js
// @match        https://anilist.co/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const TAB_ID = 'watchtab-nav-link';
  const PANEL_ID = 'watchtab-content';
  const STYLE_ID = 'watchtab-style';
  let currentAnimeId = null;

  const getAnimeId = () => {
    const match = location.pathname.match(/^\/anime\/(\d+)/);
    return match ? match[1] : null;
  };

  const normalize = value => (value || '').replace(/\\s+/g, ' ').trim().toLowerCase();

  // Find the smallest shared container holding AniList's real anime tabs.
  const findTabs = () => {
    const links = [...document.querySelectorAll('a.link, .nav a, nav a')];
    const overview = links.find(link => normalize(link.textContent) === 'overview');
    if (!overview) return null;

    let node = overview.parentElement;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const labels = [...node.querySelectorAll('a')].map(link => normalize(link.textContent));
      if (labels.includes('overview') &&
          labels.some(label => /^(characters?|staff|stats|reviews?|recommendations?)$/.test(label))) {
        return node;
      }
    }
    return overview.parentElement;
  };

  const findMediaRoot = () => {
    const tabs = findTabs();
    return tabs?.closest('.media') || document.querySelector('.media');
  };

  const findTabBranch = (tabs, root) => {
    let branch = tabs;
    while (branch.parentElement && branch.parentElement !== root) branch = branch.parentElement;
    return branch;
  };

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TAB_ID} { cursor: pointer; }
      #${TAB_ID}.active { color: var(--color-blue, #3db4f2); }
      #${PANEL_ID} {
        display: none;
        width: 100%;
        min-height: 240px;
        box-sizing: border-box;
        color: var(--color-text, inherit);
        font: inherit;
        padding: 24px 0;
      }
      #${PANEL_ID}.is-active { display: block; }
      #${PANEL_ID} .watchtab-heading {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 18px;
      }
      #${PANEL_ID} .watchtab-empty {
        color: var(--color-text-lighter, #9ba4b4);
        padding: 20px 0;
      }
      .watchtab-page-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  };

  const setWatchActive = active => {
    const panel = document.getElementById(PANEL_ID);
    const tab = document.getElementById(TAB_ID);
    const tabs = findTabs();
    const root = findMediaRoot();
    if (!panel || !tab || !tabs || !root) return;

    const tabBranch = findTabBranch(tabs, root);
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
    panel.classList.toggle('is-active', active);

    // Keep the anime header and native tab row; replace the entire page body.
    [...root.children].forEach(child => {
      if (child === tabBranch || child.contains(tabBranch) || child === panel) return;
      const isHeader = child.matches('.header-wrap, .header, .banner');
      child.classList.toggle('watchtab-page-hidden', active && !isHeader);
    });
  };

  const render = () => {
    const animeId = getAnimeId();
    if (!animeId) {
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.querySelectorAll('.watchtab-page-hidden').forEach(node => node.classList.remove('watchtab-page-hidden'));
      currentAnimeId = null;
      return;
    }

    const tabs = findTabs();
    const root = findMediaRoot();
    if (!tabs || !root) return;

    addStyles();

    let tab = document.getElementById(TAB_ID);
    if (!tab) {
      tab = document.createElement('a');
      tab.id = TAB_ID;
      tab.className = 'link';
      tab.href = '#watch';
      tab.textContent = 'Watch';
      tab.addEventListener('click', event => {
        event.preventDefault();
        setWatchActive(true);
      });
    }

    // Place Watch alongside Overview / Characters / Staff / Stats.
    if (tab.parentElement !== tabs) tabs.appendChild(tab);

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <h2 class="watchtab-heading">Episode</h2>
        <div class="watchtab-empty">Daftar episode akan ditampilkan di sini.</div>
      `;
    }
    if (panel.parentElement !== root) {
      const tabBranch = findTabBranch(tabs, root);
      tabBranch.insertAdjacentElement('afterend', panel);
    }

    if (currentAnimeId !== animeId) {
      currentAnimeId = animeId;
      setWatchActive(false);
    }
  };

  // Selecting any built-in tab returns the page to its normal content.
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || link.id === TAB_ID) return;
    const tabs = findTabs();
    if (tabs && tabs.contains(link)) setWatchActive(false);
  }, true);

  let queued = false;
  const scheduleRender = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  };

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', scheduleRender);
  scheduleRender();
})();
