// Renders a ~36 s 1920 × 1080 promo video into assets/store/video/.
// Drives the real popup on the demo article (clicks, a slider drag, themes, the ruler, Focus mode),
// captures each state, then animates them frame by frame with a cursor, captions and camera moves.
// Usage: npm run video   (needs `npx playwright install chromium` and an ffmpeg with libx264 on PATH,
// or FFMPEG=/path/to/ffmpeg)

import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { EXTENSION, ROOT, SITE, launchDemo, settle } from './demo-site.mjs';

const OUT = join(ROOT, 'assets/store/video');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const W = 1920;
const H = 1080;

// Stage geometry: a browser window with the page at PS scale and the popup at US scale under the toolbar icon.
const WIN = { x: 281, y: 150, w: 1357, bar: 42 };
const PS = WIN.w / 1280;
const VIEW = { x: WIN.x, y: WIN.y + WIN.bar, w: WIN.w, h: 800 * PS };
const US = 1.15;
const POP = { x: WIN.x + WIN.w - 16 - 360 * US, y: VIEW.y + 8, w: 360 * US, h: 600 * US };
const ICON = { x: WIN.x + WIN.w - 24, y: WIN.y + WIN.bar / 2 };

const onPage = (x, y) => ({ x: VIEW.x + x * PS, y: VIEW.y + y * PS });
// Camera anchors are in page-view pixels: the zoom happens inside the browser window.
const anchor = (x, y) => ({ ax: x * PS, ay: y * PS });
const onPopup = (r) => ({ x: POP.x + (r.x + r.w / 2) * US, y: POP.y + (r.y + r.h / 2) * US });

// ---------------------------------------------------------------------------------------------- capture

const FONT_SIZES = [18, 19, 20, 21, 22, 23];
const RULER_X = 520;
const RULER_Y = Array.from({ length: 32 }, (_, i) => 330 + i * 12);

async function capture(dir) {
  const demo = await launchDemo({ deviceScaleFactor: 2 });
  const { worker, extensionId, newPopupPage } = demo;
  await worker.evaluate(() => chrome.storage.local.set({ fw_prefs: { defaultScope: 'site', autoDark: { mode: 'off', start: '21:00', end: '07:00' } } }));
  const geo = {};
  const shot = (page, key) => page.screenshot({ path: join(dir, `${key}.jpg`), type: 'jpeg', quality: 92 });
  const rect = (popup, selector) =>
    popup.locator(selector).first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
  const click = async (popup, selector) => {
    const r = await rect(popup, selector);
    await popup.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
    return r;
  };
  const both = async (page, popup, suffix) => {
    await settle(popup);
    await settle(page);
    await shot(popup, `u-${suffix}`);
    await shot(page, `p-${suffix}`);
  };
  const scrollReading = (popup, selector) =>
    popup.evaluate((s) => {
      const view = document.querySelector('#view-reading');
      view.scrollTop += document.querySelector(s).getBoundingClientRect().top - view.getBoundingClientRect().top - 8;
    }, selector);

  const page = await demo.context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(SITE, { waitUntil: 'load' });
  await page.mouse.move(1270, 790);

  const popup = await newPopupPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.locator('body.ready').waitFor();
  await popup.locator('.font-btn').first().waitFor();
  await both(page, popup, 'start');

  geo.best = await click(popup, '[data-preset="best"]');
  await both(page, popup, 'best');

  geo.tabReading = await click(popup, '#tab-reading');
  await settle(popup);
  await shot(popup, 'u-reading');

  // Drag the font size slider with the mouse, like a person would.
  const slider = await rect(popup, '#ctl-fontSize');
  const [min, max] = await popup.locator('#ctl-fontSize').evaluate((el) => [Number(el.min), Number(el.max)]);
  const thumbX = (v) => slider.x + 8 + ((v - min) / (max - min)) * (slider.w - 16);
  geo.slider = FONT_SIZES.map((v) => ({ x: thumbX(v), y: slider.y + slider.h / 2, w: 0, h: 0 }));
  await popup.mouse.move(thumbX(FONT_SIZES[0]), slider.y + slider.h / 2);
  await popup.mouse.down();
  for (const v of FONT_SIZES.slice(1)) {
    await popup.mouse.move(thumbX(v), slider.y + slider.h / 2, { steps: 4 });
    await both(page, popup, `size-${v}`);
  }
  await popup.mouse.up();

  await scrollReading(popup, '#grp-colours');
  await popup.mouse.move(350, 590);
  await both(page, popup, 'colours');
  geo.dark = await click(popup, '[data-theme="dark"]');
  await both(page, popup, 'dark');
  geo.sepia = await click(popup, '[data-theme="sepia"]');
  await both(page, popup, 'sepia');

  await scrollReading(popup, '#grp-layout');
  await popup.mouse.move(350, 590);
  await settle(popup);
  await shot(popup, 'u-layout');
  geo.ruler = await click(popup, '.switch:has(#toggle-ruler)');
  await settle(popup);
  await shot(popup, 'u-ruler');

  await page.bringToFront();
  for (const [i, y] of RULER_Y.entries()) {
    await page.mouse.move(RULER_X, y);
    await page.waitForTimeout(80);
    await shot(page, `p-ruler-${i}`);
  }

  geo.focus = await rect(popup, '#btn-focus');
  await popup.mouse.move(350, 590);
  await page.mouse.move(1270, 790);
  await popup.locator('#btn-focus').click();
  await page.locator('fontwise-reader').waitFor();
  await settle(page);
  await shot(page, 'p-focus');

  await demo.close();
  return geo;
}

// ---------------------------------------------------------------------------------------------- timeline

/** Builds every animation track in stage coordinates. */
function timeline(geo) {
  const page = [{ t: 0, key: 'p-start' }];
  const popup = [{ t: 0, key: 'u-start' }];
  const cursor = [];
  const clicks = [];
  const at = (t, p) => cursor.push({ t, x: p.x, y: p.y });
  const move = (t0, t1, p) => {
    const last = cursor.at(-1);
    at(t0, last);
    at(t1, p);
  };
  const tap = (t, p, pageKey, popupKey, fade = 0.3) => {
    clicks.push({ t, x: p.x, y: p.y });
    if (pageKey) page.push({ t: t + 0.05, key: pageKey, fade });
    if (popupKey) popup.push({ t: t + 0.05, key: popupKey, fade: 0.12 });
  };

  // Scene 2–3: the cramped page, then one click on Best for reading.
  at(0, { x: 1760, y: 1120 });
  at(7.7, { x: 1760, y: 1120 });
  move(7.8, 8.7, onPopup(geo.best));
  tap(8.9, onPopup(geo.best), 'p-best', 'u-best', 0.15);

  // Scene 4: Reading tab and a slider drag.
  move(12.2, 12.8, onPopup(geo.tabReading));
  tap(12.9, onPopup(geo.tabReading), null, 'u-reading');
  const [first, ...rest] = geo.slider;
  move(13.3, 13.9, onPopup(first));
  const presses = [{ t: 14.0, down: true }];
  rest.forEach((p, i) => {
    const t = 14.2 + i * 0.42;
    move(t - 0.3, t, onPopup(p));
    page.push({ t, key: `p-size-${FONT_SIZES[i + 1]}`, fade: 0 });
    popup.push({ t, key: `u-size-${FONT_SIZES[i + 1]}`, fade: 0 });
  });
  presses.push({ t: 16.3, down: false });

  // Scene 5: themes.
  popup.push({ t: 17.4, key: 'u-colours', fade: 0.25 });
  move(17.8, 18.4, onPopup(geo.dark));
  tap(18.5, onPopup(geo.dark), 'p-dark', 'u-dark');
  move(19.6, 20.1, onPopup(geo.sepia));
  tap(20.2, onPopup(geo.sepia), 'p-sepia', 'u-sepia');

  // Scene 6: reading ruler; frames follow the cursor's real page position.
  popup.push({ t: 22.4, key: 'u-layout', fade: 0.25 });
  move(22.7, 23.3, onPopup(geo.ruler));
  tap(23.4, onPopup(geo.ruler), null, 'u-ruler');
  move(24.1, 24.7, onPage(RULER_X, RULER_Y[0]));
  const rulerFrom = 24.8;
  const rulerTo = 27.2;
  RULER_Y.forEach((y, i) => {
    const t = rulerFrom + ((rulerTo - rulerFrom) * i) / (RULER_Y.length - 1);
    at(t, onPage(RULER_X, y));
    page.push({ t, key: `p-ruler-${i}`, fade: 0 });
  });

  // Scene 7: Focus mode.
  move(27.9, 28.6, onPopup(geo.focus));
  tap(28.7, onPopup(geo.focus), 'p-focus', null, 0.5);
  move(28.9, 29.8, { x: 1760, y: 1120 });

  return {
    page,
    popup,
    cursor,
    clicks,
    presses,
    linear: [[rulerFrom, rulerTo]],
    cursorVisible: [[7.6, 29.8]],
    popupVisible: [[7.5, 24.0], [27.5, 28.8]],
    desk: [[3.0, 32.0]],
    camera: [
      { t: 3.8, s: 1, ax: 0, ay: 0 },
      { t: 6.2, s: 1.8, ...anchor(32, 420) },
      { t: 6.7, s: 1.8, ...anchor(32, 420) },
      { t: 7.4, s: 1, ...anchor(32, 420) },
    ],
    captions: [
      { t0: 3.4, t1: 7.4, title: 'Reading on the web can be hard work', sub: 'Small type, long lines and tight spacing tire your eyes.' },
      { t0: 7.7, t1: 12.0, title: 'One click makes it readable', sub: 'Best for reading picks a clear font, size and spacing for you.' },
      { t0: 12.3, t1: 17.2, title: 'Fine-tune everything, live', sub: 'Size, spacing, line length and margins — the page updates as you go.' },
      { t0: 17.5, t1: 22.2, title: 'Colours that are easy on the eyes', sub: 'Light, Sepia, Dark or high contrast, with a built-in contrast check.' },
      { t0: 22.5, t1: 27.4, title: 'A reading ruler keeps your place', sub: 'Everything else dims, so your eyes stay on the line you are reading.' },
      { t0: 27.7, t1: 31.9, title: 'Focus mode for distraction-free reading', sub: 'Just the article, in your fonts and colours.' },
    ],
    intro: [0, 3.2],
    outro: [32.2, 36.5],
    duration: 36.5,
  };
}

// ---------------------------------------------------------------------------------------------- stage

const STAGE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { font-family: Lexend, system-ui, sans-serif; color: #fff; position: relative;
         background: radial-gradient(1300px 900px at 85% -10%, rgba(99,102,241,.35), transparent 60%),
                     radial-gradient(1000px 700px at -10% 110%, rgba(129,140,248,.18), transparent 60%),
                     linear-gradient(135deg, #1e1b4b 0%, #111327 55%, #0f1117 100%); }
  .abs { position: absolute; }
  #desk { position: absolute; inset: 0; }
  .window { left: ${WIN.x}px; top: ${WIN.y}px; width: ${WIN.w}px; border-radius: 14px; overflow: hidden; background: #fff;
            box-shadow: 0 40px 80px -20px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.1); }
  .bar { height: ${WIN.bar}px; background: #e9eaf0; display: flex; align-items: center; gap: 8px; padding: 0 16px;
         border-bottom: 1px solid #d6d8e1; }
  .bar i { width: 13px; height: 13px; border-radius: 50%; background: #ff5f57; }
  .bar i:nth-child(2) { background: #febc2e; } .bar i:nth-child(3) { background: #28c840; }
  .url { flex: 1; margin: 0 14px 0 12px; height: 26px; border-radius: 13px; background: #fff; color: #555;
         font: 14px/26px system-ui, sans-serif; padding-left: 14px; }
  .bar img { width: 26px; height: 26px; border-radius: 7px; }
  .view { position: relative; z-index: 0; height: ${VIEW.h}px; overflow: hidden; }
  .cam { position: absolute; inset: 0; transform-origin: 0 0; }
  .view img, .pop img { position: absolute; inset: 0; width: 100%; opacity: 0; }
  .pop { left: ${POP.x}px; top: ${POP.y}px; width: ${POP.w}px; height: ${POP.h}px; border-radius: 12px; overflow: hidden;
         background: #fff; z-index: 0; transform-origin: ${ICON.x - POP.x}px -20px;
         box-shadow: 0 30px 70px -10px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.12); }
  .caret { left: ${ICON.x - 10}px; top: ${POP.y - 9}px; width: 20px; height: 10px; }
  #cursor { left: 0; top: 0; width: 30px; height: 30px; filter: drop-shadow(0 3px 4px rgba(0,0,0,.45)); transform-origin: 0 0; }
  .ripple { width: 0; height: 0; }
  .ripple::after { content: ''; position: absolute; left: -30px; top: -30px; width: 60px; height: 60px; border-radius: 50%;
                   border: 3px solid #fbbf24; background: rgba(251,191,36,.18); transform: scale(var(--s, 0)); opacity: var(--o, 0); }
  .cap { left: 0; right: 0; top: 34px; text-align: center; }
  .cap h1 { font-size: 50px; font-weight: 600; letter-spacing: -.6px; }
  .cap p { margin-top: 8px; font-size: 25px; font-weight: 300; color: #c7d2fe; }
  .center { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .center img { width: 190px; height: 190px; border-radius: 44px; box-shadow: 0 30px 80px -10px rgba(99,102,241,.7); }
  .center h1 { margin-top: 34px; font-size: 104px; font-weight: 600; letter-spacing: -2px; }
  .center p { margin-top: 10px; font-size: 34px; font-weight: 300; color: #c7d2fe; }
  .chips { margin-top: 40px; display: flex; gap: 16px; }
  .chips span { padding: 12px 24px; border-radius: 999px; font-size: 22px; background: rgba(255,255,255,.08);
                border: 1px solid rgba(255,255,255,.18); color: #e0e7ff; }
  .chips span.accent { background: #6366f1; border-color: #6366f1; color: #fff; }
`;

function stageHtml(plan, keys) {
  const imgs = (prefix) => keys.filter((k) => k.startsWith(prefix)).map((k) => `<img data-key="${k}" src="/f/${k}.jpg" decoding="sync" alt="">`).join('');
  const caps = plan.captions.map((c, i) => `<div class="abs cap" id="cap${i}"><h1>${c.title}</h1><p>${c.sub}</p></div>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
    @font-face { font-family: Lexend; src: url(/lexend.woff2) format('woff2'); font-weight: 100 900; }
    ${STAGE_CSS}</style></head><body>
    <div id="desk">
      <div class="abs window"><div class="bar"><i></i><i></i><i></i><div class="url">dailyledger.example</div><img src="/icon.png" alt=""></div>
        <div class="view"><div class="cam" id="page">${imgs('p-')}</div></div></div>
      <div class="abs" id="popwrap">
        <svg class="abs caret" viewBox="0 0 20 10"><path d="M0 10 L10 0 L20 10 Z" fill="#fff"/></svg>
        <div class="abs pop" id="popup">${imgs('u-')}</div></div>
      <div class="abs ripple" id="ripple"></div>
      <svg class="abs" id="cursor" viewBox="0 0 24 24"><path d="M3 2 L3 19.5 L7.6 15.4 L10.6 22 L13.6 20.7 L10.7 14.2 L17 14.2 Z"
        fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>
    </div>
    ${caps}
    <div class="abs center" id="intro"><img src="/icon.png" alt=""><h1>Fontwise</h1><p>Make any web page easier to read</p></div>
    <div class="abs center" id="outro"><img src="/icon.png" alt=""><h1>Fontwise</h1>
      <p>Readable fonts and reading comfort for any web page</p>
      <div class="chips"><span class="accent">Free and open source</span><span>No data collected</span><span>Chrome · Edge · Firefox</span></div></div>
    <script>window.PLAN = ${JSON.stringify(plan)};</script>
  </body></html>`;
}

// Runs in the stage page: draws the frame at time t.
function installRenderer() {
  const P = window.PLAN;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const $ = (id) => document.getElementById(id);
  const layers = {};
  for (const id of ['page', 'popup']) {
    layers[id] = {};
    for (const img of $(id).querySelectorAll('img')) layers[id][img.dataset.key] = img;
  }
  // 0 → 1 → 0 envelope over [t0, t1] with fades of `f` seconds.
  const envelope = (t, [t0, t1], f = 0.4) => Math.min(ease(clamp((t - t0) / f)), ease(clamp((t1 - t) / f)));
  const visible = (t, spans, f) => Math.max(0, ...spans.map((s) => envelope(t, s, f)));
  const isLinear = (t) => P.linear.some(([a, b]) => t >= a && t <= b);
  const track = (t, keys, fields) => {
    let i = keys.findIndex((k) => k.t > t);
    if (i === -1) return keys.at(-1);
    if (i === 0) return keys[0];
    const a = keys[i - 1];
    const b = keys[i];
    const k = (isLinear(t) ? (x) => x : ease)(clamp((t - a.t) / (b.t - a.t || 1)));
    return Object.fromEntries(fields.map((f) => [f, lerp(a[f], b[f], k)]));
  };
  const showLayer = (t, id, events) => {
    let i = -1;
    for (let j = 0; j < events.length; j++) if (events[j].t <= t) i = j;
    const cur = events[Math.max(0, i)];
    const prev = events[Math.max(0, i - 1)];
    const mix = cur.fade ? ease(clamp((t - cur.t) / cur.fade)) : 1;
    for (const [key, img] of Object.entries(layers[id])) {
      img.style.opacity = key === cur.key ? mix : key === prev.key && mix < 1 ? 1 : 0;
      img.style.zIndex = key === cur.key ? 2 : 1;
      img.style.display = img.style.opacity === '0' ? 'none' : 'block';
    }
  };

  window.render = (t) => {
    const desk = visible(t, P.desk, 0.6);
    const cam = track(t, P.camera, ['s', 'ax', 'ay']);
    $('desk').style.opacity = desk;
    $('desk').style.transform = `translateY(${(1 - desk) * 40}px)`;
    $('page').style.transform = `translate(${cam.ax * (1 - cam.s)}px, ${cam.ay * (1 - cam.s)}px) scale(${cam.s})`;
    showLayer(t, 'page', P.page);
    showLayer(t, 'popup', P.popup);

    const pop = visible(t, P.popupVisible, 0.25);
    $('popwrap').style.opacity = pop;
    $('popup').style.transform = `scale(${0.94 + 0.06 * pop})`;
    $('popwrap').style.display = pop ? 'block' : 'none';

    const c = track(t, P.cursor, ['x', 'y']);
    const press = P.presses.findLast((p) => p.t <= t);
    const tapping = P.clicks.some((k) => t >= k.t - 0.06 && t <= k.t + 0.12);
    const scale = tapping || press?.down ? 0.86 : 1;
    $('cursor').style.opacity = visible(t, P.cursorVisible, 0.3);
    $('cursor').style.transform = `translate(${c.x - 3}px, ${c.y - 2}px) scale(${scale})`;

    const click = P.clicks.findLast((k) => k.t <= t && t - k.t < 0.6);
    const k = click ? (t - click.t) / 0.6 : 1;
    $('ripple').style.transform = click ? `translate(${click.x}px, ${click.y}px)` : '';
    $('ripple').style.setProperty('--s', 0.3 + ease(k) * 0.9);
    $('ripple').style.setProperty('--o', click ? 1 - k : 0);

    P.captions.forEach((cap, i) => {
      const v = envelope(t, [cap.t0, cap.t1], 0.45);
      $(`cap${i}`).style.opacity = v;
      $(`cap${i}`).style.transform = `translateY(${(1 - v) * 18}px)`;
    });

    for (const id of ['intro', 'outro']) {
      const span = P[id];
      const v = id === 'intro' ? Math.min(ease(clamp(t / 0.8)), ease(clamp((span[1] - t) / 0.5))) : ease(clamp((t - span[0]) / 0.8));
      const el = $(id);
      el.style.opacity = v;
      el.querySelector('img').style.transform = `scale(${0.8 + 0.2 * ease(clamp((t - span[0]) / 1))})`;
      el.style.transform = `translateY(${(1 - v) * 20}px)`;
    }
  };
}

// ---------------------------------------------------------------------------------------------- render

const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8' };

async function render(dir, plan) {
  const { readdir } = await import('node:fs/promises');
  const keys = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4));
  await writeFile(join(dir, 'stage.html'), stageHtml(plan, keys));
  const files = {
    '/stage.html': join(dir, 'stage.html'),
    '/icon.png': join(ROOT, 'assets/icons/icon-512.png'),
    '/lexend.woff2': join(EXTENSION, 'fonts/lexend/lexend-latin-wght-normal.woff2'),
  };
  const server = createServer(async (req, res) => {
    const file = files[req.url] ?? (req.url.startsWith('/f/') ? join(dir, req.url.slice(3)) : null);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/stage.html`, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.decode())]));
  await page.evaluate(installRenderer);

  // PREVIEW=1.5,9,14 writes stills at those times into PREVIEW_DIR instead of encoding.
  if (process.env.PREVIEW) {
    const out = process.env.PREVIEW_DIR ?? tmpdir();
    const stills = [];
    for (const t of process.env.PREVIEW.split(',').map(Number)) {
      await page.evaluate((s) => window.render(s), t);
      stills.push(join(out, `preview-${t}.jpg`));
      await page.screenshot({ path: stills.at(-1), type: 'jpeg', quality: 85 });
    }
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    return stills;
  }

  const video = join(OUT, 'fontwise-promo.mp4');
  const ffmpeg = spawn(FFMPEG, [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))));

  const frames = Math.round(plan.duration * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ffmpeg.stdin.write(jpeg)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if (i % 150 === 0) process.stdout.write(`  frame ${i}/${frames}\n`);
  }
  ffmpeg.stdin.end();
  await done;

  // A thumbnail for YouTube: the outro card.
  await page.evaluate((t) => window.render(t), plan.duration - 0.5);
  const thumb = join(OUT, 'fontwise-promo-thumbnail.jpg');
  await page.screenshot({ path: thumb, type: 'jpeg', quality: 90 });

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  return [video, thumb];
}

// ---------------------------------------------------------------------------------------------- main

const probe = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
if (probe.error || !probe.stdout.includes('libx264')) {
  console.error(`An ffmpeg with libx264 is required (looked for "${FFMPEG}"). Install it (e.g. \`brew install ffmpeg\`) or set FFMPEG.`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'fontwise-video-'));
try {
  console.log('Capturing the extension…');
  const geo = await capture(dir);
  console.log('Rendering frames…');
  const files = await render(dir, timeline(geo));
  for (const file of files) console.log(`wrote ${file.replace(ROOT, '')}`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
