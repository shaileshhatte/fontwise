/*
  content.js — Fontwise page integration.

  Applies the effective settings as one <style> element, draws the reading
  ruler and Focus mode overlays (closed shadow roots), and switches to dark
  colours at night when automatic dark is on. Nothing runs until settings
  arrive, so pages Fontwise is not used on pay almost nothing.
  Requires shared/bundled-fonts.js, settings.js and css.js (loaded before it).
*/

'use strict';

(() => {
  const ext = globalThis.browser ?? globalThis.chrome;
  const FW = globalThis.Fontwise;
  const root = document.documentElement;
  // XML, SVG and other non-HTML documents are left alone.
  if (!FW?.buildCss || !(root instanceof HTMLElement)) return;

  const STYLE_ID = '__fontwise_style__';
  const HOSTS = ':scope > fontwise-ruler, :scope > fontwise-reader, :scope > fontwise-toast';
  const Z_TOP = '2147483647';
  const URL_FOR = (file) => ext.runtime.getURL(file);

  function restorePage({ overflow, priority, bodyInert }) {
    if (overflow) root.style.setProperty('overflow', overflow, priority);
    else root.style.removeProperty('overflow');
    if (document.body) document.body.inert = bodyInert;
  }

  // A re-injected copy (e.g. after an extension update) replaces the old one.
  try {
    FW.contentTeardown?.();
  } catch {
    // The previous copy belonged to an unloaded extension instance.
  }
  for (const stale of root.querySelectorAll(HOSTS)) {
    try {
      if (stale.dataset.restore) restorePage(JSON.parse(stale.dataset.restore));
    } catch {
      // Unreadable restore data; removing the overlay is still correct.
    }
    stale.remove();
  }

  const state = { settings: null, autoDark: null, pushed: false };
  let dead = false;
  let media = null;
  let lastCss = null;
  let nightTimer = 0;
  let ruler = null;
  let reader = null;

  const active = () => !!state.settings && state.settings.enabled !== false;

  // MediaQueryLists and their listeners are created only once Fontwise is actually used on the page.
  function watch() {
    if (media) return;
    media = { dark: matchMedia('(prefers-color-scheme: dark)'), forced: matchMedia('(forced-colors: active)') };
    media.dark.addEventListener('change', render);
    media.forced.addEventListener('change', render);
    document.addEventListener('visibilitychange', onVisible);
  }

  function onVisible() {
    if (document.visibilityState === 'visible') render();
  }

  function render() {
    if (dead) return;
    // After an extension update or uninstall this copy is orphaned: leave the page as it is and stop.
    if (!ext.runtime?.id) {
      teardown();
      return;
    }
    if (!active() && !reader && lastCss === null) return;
    watch();
    const night = FW.isNight(state.autoDark, new Date(), media.dark.matches);
    const options = { urlFor: URL_FOR, forcedColors: media.forced.matches, night };
    let css = active() ? FW.buildCss(state.settings, options) : '';

    if (reader) {
      reader.style.textContent = FW.readerCss(state.settings, { ...options, prefersDark: media.dark.matches });
      // @font-face rules are ignored inside shadow roots, so the reader's faces live in the page sheet.
      css += `\n${FW.fontFaceCss(reader.fontStack(), URL_FOR)}`;
    }

    writeStyle(css.trim());
    syncRuler(active() && state.settings.readingRuler);

    clearTimeout(nightTimer);
    const wait = active() || reader ? FW.msUntilNightChange(state.autoDark) : null;
    if (wait != null) nightTimer = setTimeout(render, wait + 500);
  }

  function writeStyle(css) {
    let style = document.getElementById(STYLE_ID);
    if (css === lastCss && (style || !css)) return;
    lastCss = css;
    if (!css) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
    }
    style.textContent = css;
    // Appending last lets our sheet win ties with page styles.
    (document.head ?? root).append(style);
  }

  function hostElement(tag, pointerEvents) {
    const host = document.createElement(tag);
    const styles = {
      all: 'initial', position: 'fixed', inset: '0', display: 'block', 'z-index': Z_TOP, 'pointer-events': pointerEvents,
    };
    for (const [property, value] of Object.entries(styles)) host.style.setProperty(property, value, 'important');
    return host;
  }

  function element(tag, attributes = {}, text = '') {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) if (value) el.setAttribute(name, value);
    if (text) el.textContent = text;
    return el;
  }

  // ---- Reading ruler ------------------------------------------------------

  const RULER_CSS = `
    .band { position: fixed; inset-inline: 0; top: 0; height: var(--fw-band); will-change: transform;
      box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.38); forced-color-adjust: none; transition: height 150ms ease; }
    @media (prefers-reduced-motion: reduce) { .band { transition: none; } }
  `;

  function syncRuler(on) {
    if (!on) {
      if (ruler) {
        document.removeEventListener('pointermove', ruler.onPointer);
        document.removeEventListener('focusin', ruler.onFocus);
        cancelAnimationFrame(ruler.frame);
        ruler.host.remove();
        ruler = null;
      }
      return;
    }

    const s = state.settings;
    const height = Math.max(32, Math.round((s.fontSize ?? 16) * (s.lineHeight ?? 1.5) * 1.6));
    if (ruler) {
      if (ruler.height !== height) {
        ruler.height = height;
        ruler.band.style.setProperty('--fw-band', `${height}px`);
        ruler.move(ruler.y);
      }
      if (!ruler.host.isConnected) root.append(ruler.host);
      return;
    }

    const host = hostElement('fontwise-ruler', 'none');
    host.style.setProperty('contain', 'strict', 'important');
    host.setAttribute('aria-hidden', 'true');
    const shadow = host.attachShadow({ mode: 'closed' });
    const band = element('div', { class: 'band' });
    band.style.setProperty('--fw-band', `${height}px`);
    shadow.append(element('style', {}, RULER_CSS), band);

    ruler = {
      host,
      band,
      height,
      frame: 0,
      y: Math.round(innerHeight * 0.4),
      move(y) {
        ruler.y = y;
        band.style.transform = `translateY(${Math.round(y - ruler.height / 2)}px)`;
      },
      // Compositor-only updates, at most once per frame.
      onPointer(event) {
        if (!ruler || ruler.frame) return;
        ruler.frame = requestAnimationFrame(() => {
          if (!ruler) return;
          ruler.frame = 0;
          ruler.move(event.clientY);
        });
      },
      // Keyboard users: follow the focused element.
      onFocus(event) {
        const rect = event.target?.getBoundingClientRect?.();
        if (ruler && rect?.height) ruler.move(rect.top + rect.height / 2);
      },
    };
    ruler.move(ruler.y);
    document.addEventListener('pointermove', ruler.onPointer, { passive: true });
    document.addEventListener('focusin', ruler.onFocus, { passive: true });
    root.append(host);
  }

  // ---- Focus mode (reader) ------------------------------------------------

  /*
    Readability's output is page-controlled HTML. Moving parsed nodes into the
    page is unsafe in Chromium (a removed on* attribute can still fire), so the
    article is rebuilt from scratch: new elements, allowlisted tags and
    attributes only, and URLs restricted to http(s)/mailto.
  */
  const TITLE_ID = 'fontwise-title';
  const DROP = new Set([
    'script', 'style', 'link', 'meta', 'base', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form',
    'input', 'button', 'select', 'textarea', 'noscript', 'template', 'svg', 'math', 'canvas', 'dialog', 'source', 'track',
  ]);
  const ALLOWED = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'q', 'cite', 'figure',
    'figcaption', 'img', 'a', 'em', 'strong', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark', 'abbr', 'time', 'code',
    'pre', 'kbd', 'samp', 'var', 'br', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup',
    'col', 'span', 'div', 'section', 'details', 'summary', 'del', 'ins', 'bdi', 'bdo', 'wbr', 'video', 'audio',
  ]);
  const ATTRIBUTES = new Set([
    'lang', 'dir', 'title', 'alt', 'width', 'height', 'colspan', 'rowspan', 'headers', 'scope', 'datetime', 'start',
    'reversed', 'open', 'id', 'span',
  ]);
  const URL_ATTRIBUTES = { a: ['href'], img: ['src'], video: ['src', 'poster'], audio: ['src'] };
  const SAFE_IMAGE = /^data:image\/(png|gif|jpe?g|webp|avif);base64,[a-z0-9+/=\s]+$/i;

  function safeUrl(value, element) {
    const text = value.trim();
    if (element === 'a' && text.startsWith('#')) return text;
    if (element === 'img' && SAFE_IMAGE.test(text)) return text;
    try {
      const url = new URL(text, document.baseURI);
      const ok = url.protocol === 'https:' || url.protocol === 'http:' || (element === 'a' && url.protocol === 'mailto:');
      return ok ? url.href : null;
    } catch {
      return null;
    }
  }

  /** Copies `source`'s children into `target` as fresh, inert elements of the live document. */
  function rebuild(source, target) {
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.append(node.data);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || DROP.has(node.localName)) continue;
      if (!ALLOWED.has(node.localName)) {
        rebuild(node, target);
        continue;
      }
      const tag = node.localName;
      // The reader shows its own <h1>.
      const el = document.createElement(tag === 'h1' ? 'h2' : tag);
      for (const { name, value } of node.attributes) {
        if (ATTRIBUTES.has(name) && !(name === 'id' && value === TITLE_ID)) el.setAttribute(name, value);
      }
      for (const name of URL_ATTRIBUTES[tag] ?? []) {
        const url = node.hasAttribute(name) ? safeUrl(node.getAttribute(name), tag) : null;
        if (url) el.setAttribute(name, url);
      }
      if (tag === 'a' && !el.getAttribute('href')?.startsWith('#')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      } else if (tag === 'img') {
        el.setAttribute('loading', 'lazy');
        el.setAttribute('decoding', 'async');
      } else if (tag === 'video' || tag === 'audio') {
        el.setAttribute('controls', '');
        el.setAttribute('preload', 'metadata');
      }
      rebuild(node, el);
      target.append(el);
    }
  }

  function readingMinutes(text) {
    const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
    const units = cjk ? text.length / 500 : text.split(/\s+/).filter(Boolean).length / 230;
    return Math.max(1, Math.round(units));
  }

  // Readability returns something for almost any page; below this much text there is nothing to focus on.
  const MIN_ARTICLE_CHARS = 200;

  function parseArticle() {
    if (typeof globalThis.Readability !== 'function') return null;
    try {
      const clone = document.cloneNode(true);
      for (const host of clone.documentElement.querySelectorAll(HOSTS)) host.remove();
      const article = new globalThis.Readability(clone, { charThreshold: 300 }).parse();
      return article?.content && (article.textContent?.trim().length ?? 0) >= MIN_ARTICLE_CHARS ? article : null;
    } catch {
      return null;
    }
  }

  function openReader() {
    const article = parseArticle();
    if (!article) return { ok: false, reason: 'no-article' };

    // DOMParser documents have no browsing context: nothing in them loads or runs.
    const content = new DOMParser().parseFromString(article.content, 'text/html');

    const host = hostElement('fontwise-reader', 'auto');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = element('style');
    const backdrop = element('div', {
      class: 'fw-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': TITLE_ID, tabindex: '-1',
    });
    const bar = element('div', { class: 'fw-bar' });
    const close = element('button', { class: 'fw-close', type: 'button' }, ext.i18n.getMessage('readerClose'));
    const minutes = ext.i18n.getMessage('readerMinutes', [String(readingMinutes(article.textContent))]);
    bar.append(
      element('span', { class: 'fw-site' }, article.siteName || location.hostname),
      element('span', { class: 'fw-time' }, minutes),
      close,
    );
    const body = element('article', { class: 'fw-article', lang: article.lang || root.lang, dir: article.dir });
    body.append(element('h1', { id: TITLE_ID }, article.title || document.title || location.hostname));
    if (article.byline) body.append(element('p', { class: 'fw-byline' }, article.byline));
    rebuild(content.body, body);
    backdrop.append(bar, body);
    shadow.append(style, backdrop);

    close.addEventListener('click', closeReader);
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeReader();
      }
    });
    // Keep keystrokes away from page shortcuts (j/k, /, …) while reading.
    host.addEventListener('keydown', (event) => event.stopPropagation());
    backdrop.addEventListener('click', (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      try {
        shadow.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)))?.scrollIntoView({ block: 'start' });
      } catch {
        // Malformed fragment.
      }
    });

    const restore = {
      overflow: root.style.getPropertyValue('overflow'),
      priority: root.style.getPropertyPriority('overflow'),
      bodyInert: document.body?.inert ?? false,
    };
    host.dataset.restore = JSON.stringify(restore);
    reader = {
      host,
      style,
      restore,
      previousFocus: document.activeElement,
      fontStack: () => state.settings?.font?.stack ?? FW.READER_FONT,
    };
    root.style.setProperty('overflow', 'hidden', 'important');
    if (document.body) document.body.inert = true;
    root.append(host);
    render();
    backdrop.focus({ preventScroll: true });
    return { ok: true, open: true };
  }

  function closeReader() {
    if (!reader) return { ok: true, open: false };
    const { host, previousFocus, restore } = reader;
    reader = null;
    host.remove();
    restorePage(restore);
    previousFocus?.focus?.({ preventScroll: true });
    render();
    return { ok: true, open: false };
  }

  // ---- Messaging ----------------------------------------------------------

  const TOAST_CSS = `
    .toast { position: fixed; inset-block-end: 24px; inset-inline: 0; margin-inline: auto; width: max-content;
      max-width: calc(100vw - 32px); padding: 10px 16px; border-radius: 8px; background: #1e1e2e; color: #f4f4f8;
      font: 500 14px/1.4 system-ui, sans-serif; box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
      border: 1px solid #6366f1; animation: in 160ms ease-out; }
    @keyframes in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `;

  /** Brief on-page message for actions started by keyboard shortcuts, announced to screen readers. */
  function toast(text) {
    root.querySelector(':scope > fontwise-toast')?.remove();
    const host = hostElement('fontwise-toast', 'none');
    host.style.setProperty('inset', 'auto 0 0 0', 'important');
    const shadow = host.attachShadow({ mode: 'closed' });
    const box = element('div', { class: 'toast', role: 'status' });
    shadow.append(element('style', {}, TOAST_CSS), box);
    root.append(host);
    // Filled after insertion so assistive technology announces the change.
    setTimeout(() => (box.textContent = text), 50);
    setTimeout(() => host.remove(), 3500);
  }

  function toggleReader(notify) {
    const result = reader ? closeReader() : openReader();
    if (notify && !result.ok) toast(ext.i18n.getMessage('readerNoArticle'));
    return result;
  }

  function update(reply) {
    state.settings = FW.sanitizeSettings(reply?.settings);
    state.autoDark = FW.sanitizePrefs({ autoDark: reply?.autoDark }).autoDark;
    render();
  }

  function onMessage(message, _sender, sendResponse) {
    switch (message?.type) {
      case 'FW_APPLY':
        state.pushed = true;
        update(message);
        sendResponse(true);
        break;
      case 'FW_PING':
        sendResponse(true);
        break;
      case 'FW_READER':
        sendResponse(toggleReader(message.notify === true));
        break;
    }
  }

  function fetchSettings() {
    ext.runtime.sendMessage({ type: 'FW_GET' })
      .then((reply) => {
        if (!state.pushed) update(reply);
      })
      .catch(() => {});
  }

  // Pages restored from the back/forward cache may have missed changes.
  function onPageShow(event) {
    if (!event.persisted) return;
    state.pushed = false;
    fetchSettings();
  }

  function onReady() {
    // Forces a re-append so our sheet follows the styles the page added while parsing.
    lastCss = null;
    render();
  }

  function teardown() {
    dead = true;
    clearTimeout(nightTimer);
    removeEventListener('pageshow', onPageShow);
    document.removeEventListener('DOMContentLoaded', onReady);
    document.removeEventListener('visibilitychange', onVisible);
    media?.dark.removeEventListener('change', render);
    media?.forced.removeEventListener('change', render);
    syncRuler(false);
    closeReader();
    try {
      ext.runtime.onMessage.removeListener(onMessage);
    } catch {
      // Orphaned copies can no longer touch extension APIs.
    }
  }

  ext.runtime.onMessage.addListener(onMessage);
  addEventListener('pageshow', onPageShow);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  FW.contentTeardown = teardown;

  fetchSettings();
})();
