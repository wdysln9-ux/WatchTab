// ==UserScript==
// @name         AniList Watch Tab
// @namespace    https://github.com/wdysln9-ux/WatchTab
// @version      0.1.1
// @description  Adds an experimental Watch panel to AniList anime pages.
// @match        https://anilist.co/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const ROOT_ID = 'watchtab-root';
  const STYLE_ID = 'watchtab-style';
  let lastAnimeId = null;

  const getAnimeId = () => {
    const match = location.pathname.match(/^\/anime\/(\d+)/);
    return match ? match[1] : null;
  };

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        margin: 18px 0;
        font-family: inherit;
      }
      #${ROOT_ID} .watchtab-trigger {
        border: 0;
        border-radius: 7px;
        padding: 10px 16px;
        color: var(--color-blue, #3db4f2);
        background: var(--color-foreground, rgba(35, 38, 46, .8));
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      #${ROOT_ID} .watchtab-trigger[aria-expanded="true"] {
        color: #fff;
        background: var(--color-blue, #3db4f2);
      }
      #${ROOT_ID} .watchtab-panel {
        display: none;
        margin-top: 12px;
        padding: 18px;
        border-radius: 8px;
        color: var(--color-text, #edf1f5);
        background: var(--color-foreground, rgba(35, 38, 46, .8));
      }
      #${ROOT_ID} .watchtab-panel.is-open { display: block; }
      #${ROOT_ID} .watchtab-muted {
        color: var(--color-text-lighter, #9ba4b4);
        font-size: .9rem;
      }
    `;
    document.head.appendChild(style);
  };

  const findMountPoint = () =>
    document.querySelector('.media .content') ||
    document.querySelector('.media .overview') ||
    document.querySelector('.media') ||
    document.querySelector('main');

  const render = () => {
    const animeId = getAnimeId();
    if (!animeId) {
      document.getElementById(ROOT_ID)?.remove();
      lastAnimeId = null;
      return;
    }

    const mount = findMountPoint();
    if (!mount) return;

    const existing = document.getElementById(ROOT_ID);
    if (existing && lastAnimeId === animeId) return;
    existing?.remove();

    addStyles();

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.dataset.animeId = animeId;
    root.innerHTML = `
      <button class="watchtab-trigger" type="button" aria-expanded="false">
        Watch
      </button>
      <div class="watchtab-panel" aria-live="polite">
        <strong>Watch</strong>
        <p class="watchtab-muted">
          Tab Watch berhasil dimuat untuk anime AniList #${animeId}.
          Daftar episode dan thumbnail akan ditambahkan pada tahap berikutnya.
        </p>
      </div>
    `;

    const trigger = root.querySelector('.watchtab-trigger');
    const panel = root.querySelector('.watchtab-panel');
    trigger.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });

    mount.prepend(root);
    lastAnimeId = animeId;
  };

  const scheduleRender = (() => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        render();
      });
    };
  })();

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', scheduleRender);
  scheduleRender();
})();