// Renders the 1280 × 800 store screenshots into assets/store/screenshots/.
// Captures the real extension in Chromium on a local demo article, then composes annotated slides.
// Usage: npm run screenshots   (needs `npx playwright install chromium`)

import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXTENSION = join(ROOT, 'extension');
const OUT = join(ROOT, 'assets/store/screenshots');
const HOST = 'dailyledger.example';
const SITE = `http://${HOST}`;

// Original copy written for these screenshots; the publication is fictional.
const ARTICLE = {
  title: 'Why the shape of a page decides how much of it we read',
  dek: 'Designers have known for a century that line length, spacing and contrast change comprehension. Most of the web still ignores them.',
  byline: 'By Morgan Ellis',
  date: 'October 30, 2026',
  paragraphs: [
    'Open almost any news site on a laptop and you will meet the same page: small type set across a column wide enough to hold a paragraph on a single line, grey text on a white background, and spacing so tight that the eye slips from one line to the next. None of it is intentional. It is simply what happens when typography is left to defaults.',
    'Reading researchers have measured the cost for decades. Lines longer than about seventy-five characters make it harder to find the start of the next line, so readers re-read or skip. Generous line spacing reduces those errors, and a comfortable size lowers the effort of decoding each word. The differences sound small, but over a long article they add up to real fatigue.',
    'For readers with dyslexia, low vision or simply tired eyes, the effect is larger still. Fonts with clearly distinct letter shapes — where a capital I, a lower-case l and the number 1 never look alike — measurably reduce misreadings. Slightly wider letter and word spacing helps the eye separate words that would otherwise blur together.',
    'Colour matters too. Pure black on bright white can glare at night, while pale grey on white often fails basic contrast guidelines. A warm sepia or a well-balanced dark theme can make the same text easier to read for longer, as long as the contrast between text and background stays high.',
    'The good news is that none of this requires a redesign. A page that respects a reader’s preferences — their font, their size, their spacing and their colours — becomes readable without anyone else having to change a thing.',
    'Publishers can still do their part. Sensible defaults, a measured column and real contrast are cheap to provide and benefit everyone. Until then, readers can take matters into their own hands.',
  ],
};

const MOST_READ = [
  'The quiet return of the public library',
  'What a century of road signs teaches about legibility',
  'Inside the studio designing type for small screens',
  'How long should a paragraph be?',
  'The case for reading on paper, revisited',
];

const ARTICLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${ARTICLE.title}</title>
<style>
  body { margin: 0; font: 14px/1.3 "Times New Roman", Times, serif; color: #666; background: #fff; }
  .masthead { border-bottom: 1px solid #ddd; padding: 14px 32px; display: flex; align-items: baseline; gap: 28px; }
  .logo { font: 700 26px/1 Georgia, serif; color: #111; letter-spacing: -0.5px; }
  nav a { font: 13px Arial, sans-serif; color: #333; text-decoration: none; margin-right: 18px; }
  .wrap { display: flex; gap: 36px; padding: 22px 32px; }
  article { flex: 1; }
  h1 { font: 700 30px/1.15 Georgia, serif; color: #111; margin: 6px 0 8px; }
  .dek { font-size: 17px; color: #444; margin: 0 0 10px; }
  .meta { font: 12px Arial, sans-serif; color: #888; margin: 0 0 14px; }
  article p { margin: 0 0 6px; }
  aside { width: 250px; flex: none; font: 13px Arial, sans-serif; }
  aside h2 { font: 700 13px Arial, sans-serif; text-transform: uppercase; border-top: 3px solid #111; padding-top: 8px; color: #111; }
  aside ol { padding-left: 18px; } aside li { margin-bottom: 10px; color: #333; }
  .ad { height: 250px; background: repeating-linear-gradient(45deg, #f2f2f2 0 10px, #e9e9e9 10px 20px); color: #999;
        display: grid; place-items: center; font: 11px Arial, sans-serif; margin-bottom: 18px; }
</style></head>
<body>
  <header class="masthead"><span class="logo">The Daily Ledger</span>
    <nav><a href="/">World</a><a href="/">Business</a><a href="/">Technology</a><a href="/">Ideas</a><a href="/">Culture</a></nav></header>
  <div class="wrap">
    <article>
      <h1>${ARTICLE.title}</h1>
      <p class="dek">${ARTICLE.dek}</p>
      <p class="meta">${ARTICLE.byline} · ${ARTICLE.date}</p>
      ${ARTICLE.paragraphs.map((p) => `<p>${p}</p>`).join('\n      ')}
    </article>
    <aside><div class="ad">Advertisement</div><h2>Most read</h2><ol>${MOST_READ.map((t) => `<li>${t}</li>`).join('')}</ol></aside>
  </div>
</body>
</html>`;


// ---------------------------------------------------------------------------------------------- capture

/** Captures raw 2× screenshots and the rectangles (CSS px) of the controls the slides point at. */
async function capture(dir) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(ARTICLE_HTML);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const profile = await mkdtemp(join(tmpdir(), 'fontwise-profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    deviceScaleFactor: 2,
    colorScheme: 'light',
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${server.address().port}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const shots = {};
  const rects = {};

  const shot = async (page, name, options = {}) => {
    shots[name] = join(dir, `${name}.png`);
    await page.screenshot({ path: shots[name], ...options });
  };
  const measure = async (page, name, selectors) => {
    rects[name] = await page.evaluate((sel) => {
      const out = {};
      for (const [key, s] of Object.entries(sel)) {
        const [query, index = 0] = Array.isArray(s) ? s : [s];
        const r = document.querySelectorAll(query)[index]?.getBoundingClientRect();
        if (r?.width) out[key] = { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
      }
      return out;
    }, selectors);
  };
  // Fontwise overlays use closed shadow roots; CDP can still see inside them.
  const measureShadow = async (page, name, classes) => {
    const cdp = await context.newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const found = {};
    const walk = (node) => {
      const attrs = node.attributes ?? [];
      const attr = (name) => (attrs.indexOf(name) % 2 === 0 ? attrs[attrs.indexOf(name) + 1] : undefined);
      for (const [key, c] of Object.entries(classes)) {
        const hit = c.startsWith('#') ? attr('id') === c.slice(1) : attr('class') === c;
        if (hit && !found[key]) found[key] = node.nodeId;
      }
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? []), ...(node.contentDocument ? [node.contentDocument] : [])]) walk(child);
    };
    walk(root);
    rects[name] = {};
    for (const [key, nodeId] of Object.entries(found)) {
      const { model } = await cdp.send('DOM.getBoxModel', { nodeId });
      const [x1, y1, x2, , , y3] = model.border;
      rects[name][key] = { x: x1, y: y1, w: x2 - x1, h: y3 - y1 };
    }
    await cdp.detach();
  };
  // Built-in presets with bundled fonts only, so the output does not depend on the fonts installed locally.
  const preset = (id, patch = {}) =>
    worker.evaluate(
      ([presetId, extra]) => {
        const FW = globalThis.Fontwise;
        const bundled = (fontId) => FW.FONT_CATALOG.find((f) => f.id === fontId && f.bundled) ?? null;
        return FW.sanitizeSettings({ ...FW.buildPreset(FW.PRESETS[presetId], bundled), ...extra });
      },
      [id, patch],
    );
  const setSite = (settings) => worker.evaluate(([k, s]) => chrome.storage.local.set({ [k]: s }), [`fw_site_${HOST}`, settings]);
  const settle = async (page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
  };

  const best = await preset('best');
  const sepia = await preset('best', { theme: 'sepia', bgColor: '#f4ecd8', textColor: '#433422', linkColor: '#8a4b08', readingRuler: true });
  const night = await preset('night');
  await worker.evaluate(() => chrome.storage.local.set({ fw_prefs: { defaultScope: 'site', autoDark: { mode: 'system', start: '21:00', end: '07:00' } } }));

  // Article before and after "Best for reading".
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(SITE, { waitUntil: 'load' });
  await settle(page);
  await shot(page, 'page-before');
  await setSite(best);
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  await shot(page, 'page-after');

  // Popup, acting on the article tab like the real toolbar popup.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.addInitScript((url) => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (info) => (info?.active ? query({ url: `${url}/*` }) : query(info));
  }, SITE);
  const openPopup = async () => {
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup.locator('body.ready').waitFor();
    await popup.locator('.font-btn').first().waitFor();
    await settle(popup);
  };
  const scrollReading = async (selector) => {
    await popup.locator('#tab-reading').click();
    await popup.evaluate((s) => {
      const view = document.querySelector('#view-reading');
      view.scrollTop += document.querySelector(s).getBoundingClientRect().top - view.getBoundingClientRect().top - 8;
    }, selector);
    await settle(popup);
  };

  await openPopup();
  await shot(popup, 'popup-fonts');
  await measure(popup, 'popup-fonts', {
    focus: '#btn-focus',
    options: '#btn-options',
    toggle: '.switch:has(#toggle-enabled), #toggle-enabled',
    scope: '#scope',
    presets: '#presets',
    search: '#search-input',
    cats: '#cat-tabs',
    selected: '#font-list .font-btn.selected',
  });

  await scrollReading('#grp-text');
  await shot(popup, 'popup-text');
  await measure(popup, 'popup-text', {
    active: '#active-bar',
    fontSize: '.row[data-row="fontSize"]',
    lineHeight: '.row[data-row="lineHeight"]',
    letterSpacing: '.row[data-row="letterSpacing"]',
    wordSpacing: '.row[data-row="wordSpacing"]',
    paragraphSpacing: '.row[data-row="paragraphSpacing"]',
    reset: '[data-reset="fontSize"]',
  });

  await scrollReading('#grp-colours');
  await shot(popup, 'popup-colours');
  await measure(popup, 'popup-colours', {
    themes: '#themes',
    text: '.palette[data-key="textColor"]',
    bg: '.palette[data-key="bgColor"]',
    contrast: '#contrast',
  });

  // Sepia with the reading ruler, page and popup in the same state.
  await setSite(sepia);
  await openPopup();
  await scrollReading('#grp-layout');
  await shot(popup, 'popup-layout');
  await measure(popup, 'popup-layout', {
    lineLength: '.row[data-row="lineLength"]',
    margin: '.row[data-row="marginWidth"]',
    align: '.segmented[data-key="textAlign"]',
    ruler: '.switch:has(#toggle-ruler), #toggle-ruler',
  });
  await page.bringToFront();
  await page.reload({ waitUntil: 'load' });
  await page.mouse.move(420, 610);
  await settle(page);
  await shot(page, 'page-ruler');
  await measureShadow(page, 'page-ruler', { band: 'band' });

  // Focus mode in the Night reading preset.
  await setSite(night);
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url: `${url}/*` }))[0].id, SITE);
  await worker.evaluate((id) => globalThis.Fontwise.store.toggleReader(id), tabId);
  await page.locator('fontwise-reader').waitFor();
  await settle(page);
  await shot(page, 'page-focus');
  await measureShadow(page, 'page-focus', { close: 'fw-close', time: 'fw-time', article: 'fw-article', title: '#fontwise-title' });

  // Settings page with a remembered site and a saved preset.
  await setSite(best);
  await worker.evaluate((s) => globalThis.Fontwise.store.savePreset('Evening reading', s), sepia);
  const options = await context.newPage();
  await options.setViewportSize({ width: 820, height: 900 });
  await options.goto(`chrome-extension://${extensionId}/options/options.html`);
  await options.locator('#site-list li').first().waitFor();
  await options.locator('#preset-list li').first().waitFor();
  await settle(options);
  await shot(options, 'options', { fullPage: true });
  await measure(options, 'options', {
    scope: ['#general .segmented', 0],
    sync: '.setting:has(#sync)',
    dark: ['#general .segmented', 1],
    sites: '#site-list',
    exclude: '#exclude-form',
    presets: '#preset-list',
    shortcuts: '#shortcut-list',
    exportButton: '#btn-export',
    importButton: '#btn-import',
    general: '#general',
    sitesCard: '#sites',
    shortcutsCard: '#shortcuts',
    backupCard: '#backup',
  });

  await context.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  return { shots, rects };
}

// ---------------------------------------------------------------------------------------------- compose

const dataUrl = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`;

/** CSS size of a 2× screenshot, read from the PNG header. */
async function cssSize(file) {
  const buf = await readFile(file);
  return { w: buf.readUInt32BE(16) / 2, h: buf.readUInt32BE(20) / 2 };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STYLE = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body { font-family: Lexend, system-ui, sans-serif; color: #fff; position: relative;
         background: radial-gradient(900px 600px at 85% -10%, rgba(99,102,241,.35), transparent 60%),
                     radial-gradient(700px 500px at -10% 110%, rgba(129,140,248,.18), transparent 60%),
                     linear-gradient(135deg, #1e1b4b 0%, #111327 55%, #0f1117 100%); }
  .brand { position: absolute; left: 40px; top: 34px; display: flex; align-items: center; gap: 10px;
           font-weight: 600; font-size: 18px; letter-spacing: .2px; }
  .brand img { width: 30px; height: 30px; border-radius: 8px; }
  .head { position: absolute; left: 0; right: 0; top: 30px; text-align: center; }
  .head h1 { font-size: 36px; font-weight: 600; letter-spacing: -.5px; line-height: 1.15; }
  .head p { margin-top: 8px; font-size: 17px; font-weight: 300; color: #c7d2fe; }
  .shot { position: absolute; overflow: hidden; border-radius: 14px;
          box-shadow: 0 30px 60px -12px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08); }
  .shot > img { position: absolute; display: block; }
  .window { position: absolute; border-radius: 12px; overflow: hidden; background: #fff;
            box-shadow: 0 30px 60px -12px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.1); }
  .window .bar { height: 34px; background: #e9eaf0; display: flex; align-items: center; gap: 7px; padding: 0 12px;
                 border-bottom: 1px solid #d6d8e1; }
  .window .bar i { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; }
  .window .bar i:nth-child(2) { background: #febc2e; } .window .bar i:nth-child(3) { background: #28c840; }
  .window .url { flex: 1; margin: 0 12px 0 10px; height: 22px; border-radius: 11px; background: #fff; color: #555;
                 font: 12px/22px system-ui, sans-serif; padding-left: 12px; }
  .window .ext { width: 22px; height: 22px; border-radius: 6px; }
  .window .view { position: relative; overflow: hidden; }
  .window .view img { position: absolute; display: block; }
  .tag { position: absolute; padding: 7px 16px; border-radius: 999px; font-size: 15px; font-weight: 500; }
  .tag.muted { background: rgba(255,255,255,.1); color: #e0e7ff; border: 1px solid rgba(255,255,255,.18); }
  .tag.accent { background: #6366f1; color: #fff; box-shadow: 0 8px 24px -6px rgba(99,102,241,.8); }
  .call { position: absolute; width: var(--w, 300px); padding: 12px 15px 13px; border-radius: 12px;
          background: rgba(17,19,39,.94); border: 1px solid rgba(165,180,252,.28);
          box-shadow: 0 12px 30px -10px rgba(0,0,0,.6); }
  .call b { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 600; }
  .call b span { flex: none; width: 24px; height: 24px; border-radius: 50%; background: #fbbf24; color: #1e1b4b;
                 font-size: 13px; font-weight: 700; display: grid; place-items: center; }
  .call p { margin-top: 5px; font-size: 13.5px; line-height: 1.45; font-weight: 300; color: #c7d2fe; }
  .call kbd { font: 600 12px system-ui, sans-serif; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25);
              border-radius: 5px; padding: 1px 6px; color: #fff; }
  svg.ann { position: absolute; inset: 0; width: 1280px; height: 800px; pointer-events: none; overflow: visible; }
  .arrow-big { position: absolute; width: 58px; height: 58px; border-radius: 50%; background: #fbbf24; color: #1e1b4b;
               display: grid; place-items: center; box-shadow: 0 10px 30px -6px rgba(251,191,36,.6), 0 0 0 6px rgba(15,17,23,.6); }
`;

// Runs in the slide page: positions callouts beside their targets and draws arrows and highlight rings.
function annotate(callouts) {
  const svg = document.querySelector('svg.ann');
  const NS = 'http://www.w3.org/2000/svg';
  const add = (name, attrs) => {
    const el = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
    return el;
  };
  const columns = {};
  for (const c of callouts) {
    const el = document.getElementById(c.id);
    if (c.side === 'top') continue;
    const col = (columns[c.side] ??= { bottom: c.minY ?? 150, items: [] });
    const h = el.offsetHeight;
    const want = c.t.y + c.t.h / 2 - h / 2;
    const y = Math.min(Math.max(want, col.bottom), 780 - h);
    el.style.top = `${y}px`;
    col.bottom = y + h + 14;
  }
  for (const c of callouts) {
    const el = document.getElementById(c.id).getBoundingClientRect();
    const pad = c.pad ?? 5;
    const r = { x: c.t.x - pad, y: c.t.y - pad, w: c.t.w + pad * 2, h: c.t.h + pad * 2 };
    if (c.ring !== false) {
      add('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: c.radius ?? 10, fill: 'none',
        stroke: '#fbbf24', 'stroke-width': 2.5, filter: 'url(#glow)' });
    }
    let s, e, d;
    if (c.side === 'left') {
      s = { x: el.right, y: el.top + el.height / 2 };
      e = { x: r.x, y: r.y + r.h / 2 };
    } else if (c.side === 'right') {
      s = { x: el.left, y: el.top + el.height / 2 };
      e = { x: r.x + r.w, y: r.y + r.h / 2 };
    } else {
      s = { x: el.left + el.width / 2, y: el.bottom };
      e = { x: r.x + r.w / 2, y: r.y };
    }
    if (c.side === 'top') {
      const my = (s.y + e.y) / 2;
      d = `M${s.x},${s.y} C${s.x},${my} ${e.x},${my} ${e.x},${e.y - 4}`;
    } else {
      const mx = (s.x + e.x) / 2;
      const ex = e.x + (c.side === 'left' ? -4 : 4);
      d = `M${s.x},${s.y} C${mx},${s.y} ${mx},${e.y} ${ex},${e.y}`;
    }
    add('path', { d, fill: 'none', stroke: '#fbbf24', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'marker-end': 'url(#head)' });
    add('circle', { cx: s.x, cy: s.y, r: 4.5, fill: '#fbbf24' });
  }
}

/**
 * Places a cropped screenshot. `crop` is in the screenshot's CSS px; returns a mapper from
 * screenshot rects to slide coordinates.
 */
function placed(x, y, scale, crop) {
  return {
    x, y, scale, crop,
    w: crop.w * scale,
    h: crop.h * scale,
    map: (r) => ({ x: x + (r.x - crop.x) * scale, y: y + (r.y - crop.y) * scale, w: r.w * scale, h: r.h * scale }),
  };
}

const imgTag = (src, size, p) =>
  `<img src="${src}" style="left:${-p.crop.x * p.scale}px;top:${-p.crop.y * p.scale}px;width:${size.w * p.scale}px">`;

const shotHtml = (src, size, p, radius = 14) =>
  `<div class="shot" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;border-radius:${radius}px">${imgTag(src, size, p)}</div>`;

/** A minimal browser window; the page view is `p` (placed at the view's position). */
const windowHtml = (src, size, p, icon) =>
  `<div class="window" style="left:${p.x}px;top:${p.y - 34}px;width:${p.w}px">
     <div class="bar"><i></i><i></i><i></i><div class="url">${HOST}</div><img class="ext" src="${icon}" alt=""></div>
     <div class="view" style="height:${p.h}px">${imgTag(src, size, p)}</div></div>`;

const calloutHtml = (c) =>
  `<div class="call ${c.side}" id="${c.id}" style="--w:${c.w ?? 300}px;left:${c.x}px;top:${c.y ?? 0}px">
     <b><span>${c.n}</span>${esc(c.title)}</b><p>${c.text}</p></div>`;

const union = (...rs) => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

function slides({ img, size, rects, icon }) {
  const header = (title, sub) =>
    `<div class="head"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>`;
  const list = [];

  // 1. Before / after.
  {
    const crop = { x: 0, y: 0, w: 940, h: 760 };
    const a = placed(40, 226, 0.635, crop);
    const b = placed(1240 - a.w, 226, 0.635, crop);
    list.push({
      name: '1-before-after',
      html: `${header('Make any web page easier to read', 'Readable fonts, comfortable spacing and calm colours — in one click, on any site.')}
        <div class="tag muted" style="left:${a.x}px;top:136px">Before</div>
        <div class="tag accent" style="left:${b.x}px;top:136px">After · Best for reading</div>
        ${windowHtml(img['page-before'], size['page-before'], a, icon)}
        ${windowHtml(img['page-after'], size['page-after'], b, icon)}
        <div class="arrow-big" style="left:${611}px;top:${226 + a.h / 2 - 46}px">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>`,
      callouts: [],
    });
  }

  // 2. Fonts view.
  {
    const r = rects['popup-fonts'];
    const p = placed((1280 - 378) / 2, 150, 1.05, { x: 0, y: 0, w: 360, h: 600 });
    const callouts = [
      { side: 'left', title: 'Choose where it applies', text: 'Keep changes to this tab, remember them for this site, or use them everywhere.', t: p.map(r.scope) },
      { side: 'left', title: 'One-click presets', text: 'Best for reading, Dyslexia-friendly and Night reading — or save your own.', t: p.map(r.presets) },
      { side: 'left', title: 'Search and filter fonts', text: 'Find a font by name or style. Press <kbd>/</kbd> to search.', t: p.map(union(r.search, r.cats)) },
      { side: 'right', title: 'Focus mode, settings, pause', text: 'Open a clean article view, open settings, or switch Fontwise off for this page.', t: p.map(union(r.focus, r.options, r.toggle)), radius: 16 },
      { side: 'right', title: 'Fonts made for reading', text: 'Atkinson Hyperlegible, Lexend, OpenDyslexic and Literata are built in, plus readable fonts already on your device.', t: p.map(r.selected) },
    ];
    list.push({
      name: '2-fonts',
      html: `${header('Pick a font that is easy on your eyes', 'Hand-picked reading fonts, including dyslexia-friendly ones.')}
        ${shotHtml(img['popup-fonts'], size['popup-fonts'], p)}`,
      callouts,
    });
  }

  // 3. Text controls.
  {
    const r = rects['popup-text'];
    const p = placed((1280 - 378) / 2, 150, 1.05, { x: 0, y: 0, w: 360, h: 600 });
    const callouts = [
      { side: 'left', title: 'Font size', text: 'Make text larger or smaller, from 12 to 28 px.', t: p.map(r.fontSize) },
      { side: 'left', title: 'Line and letter spacing', text: 'Give lines and letters room to breathe.', t: p.map(union(r.lineHeight, r.letterSpacing)) },
      { side: 'left', title: 'Word and paragraph spacing', text: 'Separate words and paragraphs clearly.', t: p.map(union(r.wordSpacing, r.paragraphSpacing)) },
      { side: 'right', title: 'Always know what is applied', text: 'A live summary of the font, size and theme on this page.', t: p.map(r.active), pad: 2 },
      { side: 'right', title: 'Undo any change', text: 'Every control shows its value and resets with one click.', t: p.map(r.reset), radius: 16, minY: 360 },
    ];
    list.push({
      name: '3-text-spacing',
      html: `${header('Fine-tune size and spacing', 'Every change previews live on the page.')}
        ${shotHtml(img['popup-text'], size['popup-text'], p)}`,
      callouts,
    });
  }

  // 4. Colours.
  {
    const r = rects['popup-colours'];
    const p = placed((1280 - 378) / 2, 150, 1.05, { x: 0, y: 0, w: 360, h: 600 });
    const callouts = [
      { side: 'left', title: 'Four reading themes', text: 'Light, Sepia, Dark and high Contrast.', t: p.map(r.themes) },
      { side: 'left', title: 'Your own colours', text: 'Pick text and background colours from curated palettes, or choose any shade.', t: p.map(union(r.text, r.bg)) },
      { side: 'right', title: 'Built-in contrast check', text: 'See instantly whether your colours meet WCAG AA and AAA.', t: p.map(r.contrast) },
    ];
    list.push({
      name: '4-colours',
      html: `${header('Colours that stay comfortable', 'Themes and palettes with a live accessibility check.')}
        ${shotHtml(img['popup-colours'], size['popup-colours'], p)}`,
      callouts,
    });
  }

  // 5. Layout and reading ruler: the popup hangs from the toolbar icon of a browser window.
  {
    const r = rects['popup-layout'];
    const page = placed(40, 158, 0.9375, { x: 0, y: 0, w: 1280, h: 662 });
    const pop = placed(1240 - 14 - 330, 166, 330 / 360, { x: 0, y: 0, w: 360, h: 600 });
    const band = page.map(rects['page-ruler'].band);
    const ruler = { x: band.x + 6, y: band.y, w: pop.x - band.x - 30, h: band.h };
    const callouts = [
      { side: 'left', title: 'Line length', text: 'Keep lines between 45 and 100 characters.', t: pop.map(r.lineLength), pad: 2, x: 560, w: 290 },
      { side: 'left', title: 'Margins and alignment', text: 'Widen margins, align left or justify.', t: pop.map(union(r.margin, r.align)), pad: 2, x: 560, w: 290 },
      { side: 'left', title: 'Reading ruler switch', text: 'Turn the ruler on for any page.', t: pop.map(r.ruler), radius: 16, x: 560, w: 290 },
      { side: 'top', title: 'Reading ruler', text: 'Dims everything except the lines you are reading, and follows your pointer.', t: ruler, pad: 2, radius: 6, x: 70, y: band.y - 128, w: 360 },
    ];
    list.push({
      name: '5-layout-ruler',
      html: `${header('Comfortable layout and a reading ruler', 'Shorter lines, wider margins and a ruler that keeps your place.')}
        ${windowHtml(img['page-ruler'], size['page-ruler'], page, icon)}
        ${shotHtml(img['popup-layout'], size['popup-layout'], pop, 10)}`,
      callouts,
    });
  }

  // 6. Focus mode.
  {
    const r = rects['page-focus'];
    const p = placed(40, 190, 0.7, { x: 0, y: 0, w: 1280, h: 800 });
    const callouts = [
      { side: 'right', title: 'Reading time and Close', text: 'Press <kbd>Esc</kbd> to close, or <kbd>⌥⇧B</kbd> to toggle Focus mode.', t: p.map(union(r.time, r.close)), radius: 8, x: 960, w: 280 },
      { side: 'right', title: 'Your reading settings', text: 'Fonts, spacing and colours carry over — here, the Night reading preset.', t: p.map(r.title), pad: 8, x: 960, w: 280 },
      { side: 'right', title: 'Just the article', text: 'Ads, sidebars and pop-ups are gone. Built on Mozilla Readability.', t: p.map({ ...r.article, y: 420, h: 300 }), ring: false, x: 960, w: 280 },
    ];
    callouts[0].minY = 150;
    list.push({
      name: '6-focus-mode',
      html: `${header('Focus mode for distraction-free reading', 'A clean, calm page with just the article.')}
        ${windowHtml(img['page-focus'], size['page-focus'], p, icon)}`,
      callouts,
    });
  }

  // 7. Settings: General and Sites on the left, Shortcuts and Backup on the right.
  {
    const r = rects.options;
    const card = (c, m = 0) => ({ x: c.x - m, y: c.y - m, w: c.w + m * 2, h: c.h + m * 2 });
    const left = card(union(r.general, r.sitesCard));
    const a = placed(335, 160, 0.6, left);
    const b = placed(830, 262, 410 / r.shortcutsCard.w, card(r.shortcutsCard));
    const c = placed(830, 600, 410 / r.backupCard.w, card(r.backupCard));
    const callouts = [
      { side: 'left', title: 'Default scope', text: 'Choose where new changes are saved.', t: a.map(r.scope), minY: 160, x: 40, w: 270 },
      { side: 'left', title: 'Sync across devices', text: 'Sync preferences and presets through your browser account.', t: a.map(r.sync), pad: 2, x: 40, w: 270 },
      { side: 'left', title: 'Automatic dark colours', text: 'Follow your system theme, or set a schedule.', t: a.map(r.dark), x: 40, w: 270 },
      { side: 'left', title: 'Sites you have styled', text: 'Review and forget sites, or exclude them.', t: a.map(union(r.sites, r.exclude)), x: 40, w: 270 },
      { side: 'top', title: 'Keyboard shortcuts', text: 'Work on any page, even with the popup closed.', t: b.map(r.shortcuts), x: 830, y: 160, w: 410 },
      { side: 'top', title: 'Backup and restore', text: 'Export settings to a file; import them in any browser.', t: c.map(union(r.exportButton, r.importButton)), x: 830, y: 500, w: 410 },
    ];
    list.push({
      name: '7-settings',
      html: `${header('Settings that follow you', 'Sync, per-site memory, keyboard shortcuts and backups.')}
        ${shotHtml(img.options, size.options, a, 12)}
        ${shotHtml(img.options, size.options, b, 12)}
        ${shotHtml(img.options, size.options, c, 12)}`,
      callouts,
    });
  }
  return list;
}

async function compose(shots, rects) {
  const img = {};
  const size = {};
  for (const [name, file] of Object.entries(shots)) {
    img[name] = await dataUrl(file, 'image/png');
    size[name] = await cssSize(file);
  }
  const icon = await dataUrl(join(ROOT, 'assets/icons/icon-64.png'), 'image/png');
  const lexend = await dataUrl(join(EXTENSION, 'fonts/lexend/lexend-latin-wght-normal.woff2'), 'font/woff2');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const files = [];
  for (const slide of slides({ img, size, rects, icon })) {
    slide.callouts.forEach((c, i) => {
      c.n = i + 1;
      c.id = `c${i}`;
      c.x ??= c.side === 'left' ? 70 : 905;
      if (c.side === 'left' && c.x === 70) c.w ??= 325;
    });
    await page.setContent(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
        @font-face { font-family: Lexend; src: url(${lexend}) format('woff2'); font-weight: 100 900; }
        ${STYLE}</style></head><body>
        <div class="brand"><img src="${icon}" alt="">Fontwise</div>
        ${slide.html}
        ${slide.callouts.map(calloutHtml).join('')}
        <svg class="ann"><defs>
          <marker id="head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#fbbf24"/></marker>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
      </body></html>`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(annotate, slide.callouts);
    const file = join(OUT, `fontwise-${slide.name}.png`);
    await page.screenshot({ path: file });
    files.push(file);
  }
  await browser.close();
  return files;
}

// ---------------------------------------------------------------------------------------------- main

await mkdir(OUT, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'fontwise-raw-'));
try {
  const { shots, rects } = await capture(dir);
  const files = await compose(shots, rects);
  for (const file of files) console.log(`wrote ${file.slice(ROOT.length)}`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
