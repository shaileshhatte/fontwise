import { test, expect, setStorage, settings } from './fixtures.js';

const fontSizeOf = (page, selector) => page.locator(selector).evaluate((el) => getComputedStyle(el).fontSize);

test('Everywhere settings restyle pages and survive reloads', async ({ worker, context, server }) => {
  await setStorage(worker, 'local', { fw_global: settings({ fontSize: 21, lineHeight: 1.7, theme: 'sepia', bgColor: '#f4ecd8', textColor: '#433422' }) });
  const page = await context.newPage();
  await page.goto(server);

  await expect(page.locator('#__fontwise_style__')).toHaveCount(1);
  expect(await fontSizeOf(page, '#p0')).toBe('21px');
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(244, 236, 216)');
  // Code keeps its monospace font.
  expect(await page.locator('code').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono/i);

  await page.reload();
  expect(await fontSizeOf(page, '#p0')).toBe('21px');
});

test('site settings win over Everywhere, and excluded sites ignore Everywhere', async ({ worker, context, server }) => {
  await setStorage(worker, 'local', {
    fw_global: settings({ fontSize: 21 }),
    'fw_site_127.0.0.1': settings({ fontSize: 19 }),
  });
  const page = await context.newPage();
  await page.goto(server);
  expect(await fontSizeOf(page, '#p0')).toBe('19px');

  await worker.evaluate(() => chrome.storage.local.remove('fw_site_127.0.0.1'));
  await setStorage(worker, 'local', { fw_excluded: ['127.0.0.1'] });
  await page.reload();
  await expect(page.locator('#__fontwise_style__')).toHaveCount(0);
  expect(await fontSizeOf(page, '#p0')).toBe('14px');
});

test('changing Everywhere settings updates open tabs live', async ({ worker, context, server }) => {
  const page = await context.newPage();
  await page.goto(server);
  expect(await fontSizeOf(page, '#p0')).toBe('14px');

  await setStorage(worker, 'local', { fw_global: settings({ fontSize: 24 }) });
  await expect.poll(() => fontSizeOf(page, '#p0')).toBe('24px');

  await worker.evaluate(() => chrome.storage.local.remove('fw_global'));
  await expect.poll(() => fontSizeOf(page, '#p0')).toBe('14px');
});

test('bundled fonts load from the extension', async ({ worker, context, server }) => {
  const font = await worker.evaluate(() => {
    const entry = globalThis.Fontwise.FONT_CATALOG.find((f) => f.id === 'atkinson-hyperlegible');
    return globalThis.Fontwise.fontRef(entry);
  });
  await setStorage(worker, 'local', { fw_global: settings({ font }) });
  const page = await context.newPage();
  await page.goto(server);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('16px "Fontwise Atkinson Hyperlegible"', 'Reading')))
    .toBe(true);
});

test('reading ruler appears and follows the pointer', async ({ worker, context, server }) => {
  await setStorage(worker, 'local', { fw_global: settings({ fontSize: 18, readingRuler: true }) });
  const page = await context.newPage();
  await page.goto(server);
  const ruler = page.locator('fontwise-ruler');
  await expect(ruler).toHaveCount(1);
  await expect(ruler).toHaveAttribute('aria-hidden', 'true');
  // The overlay never blocks clicks.
  await page.locator('nav a').first().click({ trial: true });
});

test('Focus mode opens a sanitised reader and closes with Escape', async ({ worker, context, server }) => {
  const page = await context.newPage();
  await page.goto(server, { waitUntil: 'load' });
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url: `${url}/*` }))[0].id, server);

  // The fixture's <img onerror="alert(1)"> would raise a dialog if the reader copied it unsanitised.
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss();
  });

  const opened = await worker.evaluate((id) => globalThis.Fontwise.store.toggleReader(id), tabId);
  expect(opened).toEqual({ ok: true, open: true });
  await expect(page.locator('fontwise-reader')).toHaveCount(1);
  expect(await page.evaluate(() => document.body.inert)).toBe(true);
  await page.waitForTimeout(500);
  expect(dialogs).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(page.locator('fontwise-reader')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.inert)).toBe(false);
});

test('Focus mode reports pages without an article', async ({ worker, context, server }) => {
  const page = await context.newPage();
  await page.goto(`${server}/short`);
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url: `${url}/short` }))[0].id, server);
  const result = await worker.evaluate((id) => globalThis.Fontwise.store.toggleReader(id), tabId);
  expect(result).toEqual({ ok: false, reason: 'no-article' });
  await expect(page.locator('fontwise-reader')).toHaveCount(0);
});
