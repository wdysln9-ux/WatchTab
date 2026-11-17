// ==UserScript==
// @name         AniList Watch Tab
// @namespace    https://github.com/wdysln9-ux/WatchTab
// @version      0.2.1
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

  const findTabs = () => {
    const candidates = [...document.querySelectorAll('.nav, .nav-wrap, nav')].sort((a, b) => a.querySelectorAll('.link').length - b.querySelectorAll('.link').length);
    return candidates.find(node => {
      const text = (node.innerText || '').toLowerCase();
      return text.includes('overview') && (text.includes('character') || text.includes('staff') || text.includes('stats'));
    }) || null;
  };

  const findContent = () =>
    document.querySelector('.media .content') ||
    document.querySelector('.media .overview') ||
    document.querySelector('.media');

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
        color: var(--color-text, inherit);
        font: inherit;
      }
      #${PANEL_ID}.is-active { display: block; }
      #${PANEL_ID} .watchtab-placeholder {
        color: var(--color-text-lighter, #9ba4b4);
        padding: 12px 0;
      }
    `;
    document.head.appendChild(style);
  };

  const setWatchActive = active => {
    const panel = document.getElementById(PANEL_ID);
    const tab = document.getElementById(TAB_ID);
    const content = findContent();
    if (!panel || !tab || !content) return;

    tab.classList.toggle('active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
    panel.classList.toggle('is-active', active);

    [...content.children].forEach(child => {
      if (child !== panel) child.style.display = active ? 'none' : '';
    });
  };

  const render = () => {
    const animeId = getAnimeId();
    if (!animeId) {
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      currentAnimeId = null;
      return;
    }

    const tabs = findTabs();
    const content = findContent();
    if (!tabs || !content) return;

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
      tabs.appendChild(tab);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="watchtab-placeholder">
          Tab Watch berhasil dimuat untuk anime AniList #${animeId}.
          Daftar episode dan thumbnail akan ditambahkan pada tahap berikutnya.
        </div>
      `;
      content.appendChild(panel);
    }

    // Keep the custom tab in the native navigation if AniList re-renders it.
    if (tab.parentElement !== tabs) tabs.appendChild(tab);
    if (panel.parentElement !== content) content.appendChild(panel);

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
