// Shared by the store screenshot and promo video tools: a fictional demo article and
// Chromium with Fontwise loaded, where dailyledger.example resolves to a local server.

import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const EXTENSION = join(ROOT, 'extension');
export const HOST = 'dailyledger.example';
export const SITE = `http://${HOST}`;

// Original copy written for the store artwork; the publication is fictional.
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

export const ARTICLE_HTML = `<!DOCTYPE html>
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

/** Launches Chromium with Fontwise and the demo site. */
export async function launchDemo({ deviceScaleFactor = 2 } = {}) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(ARTICLE_HTML);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const profile = await mkdtemp(join(tmpdir(), 'fontwise-profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    deviceScaleFactor,
    colorScheme: 'light',
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${server.address().port}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;

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

  /** A page showing the popup; a real popup acts on the active tab, so tabs.query is pointed at the demo site. */
  const newPopupPage = async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 600 });
    await popup.addInitScript((url) => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (info) => (info?.active ? query({ url: `${url}/*` }) : query(info));
    }, SITE);
    return popup;
  };

  const close = async () => {
    await context.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  };
  return { context, worker, extensionId, preset, setSite, newPopupPage, close };
}

/** Waits for web fonts and a short repaint. */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
