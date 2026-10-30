// Shared Playwright fixtures: Chromium with Fontwise loaded and a local article server.

import { test as base, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const EXTENSION = fileURLToPath(new URL('../../extension', import.meta.url));

const PARAGRAPH =
  'Typography shapes how we read. Comfortable line length, generous spacing and a calm palette let the eye ' +
  'move across the page without effort, so the reader can focus on meaning rather than on decoding letters.';

const ARTICLE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture article</title>
<style>body { font: 14px/1.2 "Times New Roman", serif; } p { margin: 0 0 4px; }</style></head>
<body>
  <nav><a href="/">Home</a> · <a href="/about">About</a></nav>
  <article>
    <h1>Reading on the web</h1>
    <p class="byline">By Test Author</p>
    ${Array.from({ length: 12 }, (_, i) => `<p id="p${i}">${PARAGRAPH}</p>`).join('\n    ')}
    <pre><code>const answer = 42;</code></pre>
    <p><a href="javascript:alert(1)">bad link</a> <img src="x" onerror="alert(1)" alt=""></p>
  </article>
  <footer>Footer text</footer>
</body>
</html>`;

export const test = base.extend({
  // One server for the whole run.
  server: [
    async ({}, use) => {
      const server = createServer((req, res) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(req.url === '/short' ? '<!DOCTYPE html><title>Short</title><p>Hi.</p>' : ARTICLE);
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      await use(`http://127.0.0.1:${server.address().port}`);
      await new Promise((resolve) => server.close(resolve));
    },
    { scope: 'worker' },
  ],

  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});

export { expect } from '@playwright/test';

/** Writes extension storage from the service worker. */
export const setStorage = (worker, area, items) =>
  worker.evaluate(([a, i]) => chrome.storage[a].set(i), [area, items]);

/**
 * Opens the popup as a page. A real popup acts on the active tab; here that would be the popup itself,
 * so tabs.query({ active: true }) is redirected to the tab showing `target`.
 */
export async function openPopup(context, extensionId, target) {
  const page = await context.newPage();
  if (target) {
    await page.addInitScript((url) => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (info) => (info?.active ? query({ url: `${url}/*` }) : query(info));
    }, target);
  }
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await page.locator('body.ready').waitFor();
  return page;
}

export const settings = (patch) => ({
  enabled: true,
  font: null,
  fontSize: null,
  lineHeight: null,
  letterSpacing: null,
  wordSpacing: null,
  paragraphSpacing: null,
  fontWeight: null,
  fontStyle: null,
  theme: null,
  textColor: null,
  bgColor: null,
  linkColor: null,
  marginWidth: null,
  lineLength: null,
  textAlign: null,
  readingRuler: false,
  keepCodeMono: true,
  ...patch,
});
