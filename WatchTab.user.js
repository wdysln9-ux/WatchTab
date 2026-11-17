// ==UserScript==
// @name         AniList Watch Tab
// @namespace    https://github.com/wdysln9-ux/WatchTab
// @version      0.4.2
// @description  Adds an AniList-aligned Watch tab with episode metadata from AniZip.
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
  let requestAnimeId = null;

  const getAnimeId = () => {
    const match = location.pathname.match(/^\/anime\/(\d+)/);
    return match ? match[1] : null;
  };

  const normalize = value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const findTabs = () => {
    const links = [...document.querySelectorAll('.nav a.link, .nav-wrap a.link, nav a.link')];
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

  const findMediaRoot = () => findTabs()?.closest('.media-page-unscoped, .media') || document.querySelector('.media-page-unscoped, .media');

  const findTabBranch = (tabs, root) => {
    let branch = tabs;
    while (branch.parentElement && branch.parentElement !== root) branch = branch.parentElement;
    return branch;
  };

  // Use AniList's own content container so its max-width and page gutters stay untouched.
  const findPageContainer = (root, tabBranch) => {
    const siblings = [...root.children];
    const tabIndex = siblings.indexOf(tabBranch);
    const afterNav = tabIndex >= 0 ? siblings.slice(tabIndex + 1) : [];
    return afterNav.find(node => node.classList.contains('container')) ||
      siblings.find(node => node.classList.contains('container') && !node.contains(tabBranch)) ||
      root.querySelector('.container');
  };

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TAB_ID} { cursor: pointer; }
      #${TAB_ID}.router-link-active,
      #${TAB_ID}.router-link-exact-active {
        color: rgb(var(--color-blue)) !important;
      }
      #${PANEL_ID} { display: none; width: 100%; box-sizing: border-box; }
      #${PANEL_ID}.is-active { display: block; }
      #${PANEL_ID} .watchtab-episodes {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
        gap: 16px;
        align-items: start;
      }
      #${PANEL_ID} .watchtab-episode {
        min-width: 0;
        overflow: hidden;
        border-radius: 3px;
        background: rgb(var(--color-foreground));
      }
      #${PANEL_ID} .watchtab-thumb {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: rgb(var(--color-foreground-grey));
      }
      #${PANEL_ID} .watchtab-episode-info { padding: 10px 12px 12px; }
      #${PANEL_ID} .watchtab-episode-number {
        color: rgb(var(--color-blue));
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 4px;
      }
      #${PANEL_ID} .watchtab-episode-title {
        color: rgb(var(--color-text));
        font-size: 1.3rem;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }
      #${PANEL_ID} .watchtab-episode-date,
      #${PANEL_ID} .watchtab-message {
        color: rgb(var(--color-text-lighter));
        font-size: 1.2rem;
        margin-top: 6px;
      }
      #${PANEL_ID} .watchtab-message { padding: 8px 0; }
      .watchtab-page-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  };

  const makeMessage = text => {
    const message = document.createElement('div');
    message.className = 'watchtab-message';
    message.textContent = text;
    return message;
  };

  const extractEpisodes = data => {
    const collection = data?.episodes ?? data?.episodesInfo ?? data?.data?.episodes ?? data?.data?.episodesInfo;
    if (Array.isArray(collection)) {
      return collection.map((episode, index) => ({
        ...episode,
        number: Number(episode.episodeNumber ?? episode.number ?? index + 1)
      })).filter(episode => Number.isFinite(episode.number));
    }
    if (collection && typeof collection === 'object') {
      return Object.entries(collection).map(([key, episode]) => ({
        ...episode,
        number: Number(episode?.episodeNumber ?? episode?.number ?? key)
      })).filter(episode => Number.isFinite(episode.number));
    }
    return [];
  };

  const renderEpisodes = (panel, data) => {
    panel.replaceChildren();
    const episodes = extractEpisodes(data).sort((a, b) => a.number - b.number);

    if (!episodes.length) {
      panel.appendChild(makeMessage('Belum ada data episode dari AniZip untuk anime ini.'));
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'watchtab-episodes';
    for (const episode of episodes) {
      const card = document.createElement('article');
      card.className = 'watchtab-episode';

      if (episode.image) {
        const image = document.createElement('img');
        image.className = 'watchtab-thumb';
        image.loading = 'lazy';
        image.src = episode.image;
        image.alt = '';
        image.referrerPolicy = 'no-referrer';
        card.appendChild(image);
      }

      const info = document.createElement('div');
      info.className = 'watchtab-episode-info';

      const number = document.createElement('div');
      number.className = 'watchtab-episode-number';
      number.textContent = `Episode ${episode.number}`;
      info.appendChild(number);

      const titles = episode.title || {};
      const title = document.createElement('div');
      title.className = 'watchtab-episode-title';
      title.textContent = titles.en || titles['x-jat'] || titles.ja || titles.native || 'Episode ' + episode.number;
      info.appendChild(title);

      const dateValue = episode.airDate || episode.airdate;
      if (dateValue) {
        const date = document.createElement('div');
        date.className = 'watchtab-episode-date';
        const parsed = new Date(dateValue);
        date.textContent = Number.isNaN(parsed.getTime()) ? dateValue : parsed.toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
        info.appendChild(date);
      }

      card.appendChild(info);
      grid.appendChild(card);
    }
    panel.appendChild(grid);
  };

  const loadEpisodes = async (animeId, panel) => {
    if (requestAnimeId === animeId) return;
    requestAnimeId = animeId;
    panel.replaceChildren(makeMessage('Memuat daftar episode…'));

    // AniZip's mappings endpoint is the canonical AniList-ID lookup.
    // The alternate v1 endpoint is used only if the mappings response has no episode list.
    const urls = [
      `https://api.ani.zip/mappings?anilist_id=${encodeURIComponent(animeId)}`,
      `https://hayase.ani.zip/v1/episodes?anilist_id=${encodeURIComponent(animeId)}`
    ];

    try {
      let episodeData = null;
      let lastError = null;
      for (const url of urls) {
        try {
          const response = await fetch(url, { method: 'GET', mode: 'cors' });
          if (!response.ok) throw new Error(`AniZip HTTP ${response.status}`);
          const data = await response.json();
          if (extractEpisodes(data).length) {
            episodeData = data;
            break;
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (getAnimeId() !== animeId) return;
      if (episodeData) {
        renderEpisodes(panel, episodeData);
      } else {
        const message = lastError
          ? 'AniZip tidak bisa diakses dari browser ini. Coba lagi nanti.'
          : 'AniZip belum menyediakan metadata episode untuk anime ini.';
        panel.replaceChildren(makeMessage(message));
        requestAnimeId = null;
      }
    } catch (error) {
      if (getAnimeId() !== animeId) return;
      panel.replaceChildren(makeMessage('Gagal memuat episode. Periksa koneksi lalu coba lagi.'));
      requestAnimeId = null;
    }
  };

  const setWatchActive = active => {
    const panel = document.getElementById(PANEL_ID);
    const tab = document.getElementById(TAB_ID);
    const tabs = findTabs();
    const root = findMediaRoot();
    if (!panel || !tab || !tabs || !root) return;

    const tabBranch = findTabBranch(tabs, root);
    const pageContainer = findPageContainer(root, tabBranch);
    if (!pageContainer) return;

    tab.classList.toggle('router-link-active', active);
    tab.classList.toggle('router-link-exact-active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
    panel.classList.toggle('is-active', active);

    [...pageContainer.children].forEach(child => {
      if (child === panel) return;
      child.classList.toggle('watchtab-page-hidden', active);
    });
    if (active) loadEpisodes(getAnimeId(), panel);
  };

  const render = () => {
    const animeId = getAnimeId();
    if (!animeId) {
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.querySelectorAll('.watchtab-page-hidden').forEach(node => node.classList.remove('watchtab-page-hidden'));
      currentAnimeId = null;
      requestAnimeId = null;
      return;
    }

    const tabs = findTabs();
    const root = findMediaRoot();
    if (!tabs || !root) return;
    const tabBranch = findTabBranch(tabs, root);
    const pageContainer = findPageContainer(root, tabBranch);
    if (!pageContainer) return;

    addStyles();

    const overviewTab = [...tabs.querySelectorAll('a')].find(link => normalize(link.textContent) === 'overview');
    if (!overviewTab) return;

    let tab = document.getElementById(TAB_ID);
    if (!tab) {
      tab = overviewTab.cloneNode(false);
      tab.id = TAB_ID;
      tab.href = '#watch';
      tab.textContent = 'Watch';
      tab.classList.remove('router-link-active', 'router-link-exact-active');
      tab.removeAttribute('aria-current');
      tab.addEventListener('click', event => {
        event.preventDefault();
        setWatchActive(true);
      });
    }
    if (overviewTab.nextElementSibling !== tab) overviewTab.insertAdjacentElement('afterend', tab);

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.appendChild(makeMessage('Pilih tab Watch untuk melihat episode.'));
    }
    if (panel.parentElement !== pageContainer) pageContainer.appendChild(panel);

    if (currentAnimeId !== animeId) {
      currentAnimeId = animeId;
      requestAnimeId = null;
      setWatchActive(false);
    }
  };

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
