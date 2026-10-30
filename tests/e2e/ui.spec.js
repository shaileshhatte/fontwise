import { test, expect, setStorage, settings, openPopup } from './fixtures.js';

const fontSizeOf = (page, selector) => page.locator(selector).evaluate((el) => getComputedStyle(el).fontSize);

test('popup renders localised, labelled controls without errors', async ({ context, extensionId }) => {
  const errors = [];
  context.on('weberror', (error) => errors.push(error.error().message));
  const page = await openPopup(context, extensionId);

  // A popup opened on a non-web page explains why it is locked.
  await expect(page.locator('#notice')).toBeVisible();

  // No raw message keys leak into the UI.
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\b(?:scope|preset|opt|view|theme|weight)[A-Z]\w+\b/);

  // Every visible interactive control has an accessible name.
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button, input, [role="radio"], [role="tab"]')]
      .filter((el) => el.getClientRects().length)
      .filter((el) => !(el.getAttribute('aria-label') || el.labels?.[0]?.textContent.trim() || el.textContent.trim() ||
        el.getAttribute('aria-labelledby') || el.title))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unnamed).toEqual([]);
  expect(errors).toEqual([]);
});

test('popup applies a preset to the page and saves it for the site', async ({ worker, context, extensionId, server }) => {
  const article = await context.newPage();
  await article.goto(server);
  const popup = await openPopup(context, extensionId, server);

  await expect(popup.locator('#notice')).toBeHidden();
  await expect(popup.locator('[data-scope="site"]')).toHaveAttribute('aria-checked', 'true');
  await popup.locator('[data-preset="best"]').click();

  await expect.poll(() => fontSizeOf(article, '#p0')).toBe('18px');
  await expect(popup.locator('#status')).toContainText(/applied/i);
  await expect
    .poll(async () => (await worker.evaluate(() => chrome.storage.local.get('fw_site_127.0.0.1')))['fw_site_127.0.0.1']?.fontSize)
    .toBe(18);

  // "This tab" copies the settings into a tab-only layer that overrides the site.
  await popup.locator('[data-scope="tab"]').click();
  await expect
    .poll(async () => Object.keys(await worker.evaluate(() => chrome.storage.session.get(null))).some((k) => k.startsWith('fw_tab_')))
    .toBe(true);

  // Reset removes one layer at a time: first the tab override, then the site.
  await popup.locator('#btn-reset').click();
  await expect(popup.locator('[data-scope="site"]')).toHaveAttribute('aria-checked', 'true');
  expect(await fontSizeOf(article, '#p0')).toBe('18px');
  await popup.locator('#btn-reset').click();
  await expect.poll(() => fontSizeOf(article, '#p0')).toBe('14px');
});

test('popup tabs and font grid support arrow keys', async ({ context, extensionId, server }) => {
  const article = await context.newPage();
  await article.goto(server);
  const page = await openPopup(context, extensionId, server);

  await page.locator('#tab-fonts').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-reading')).toBeFocused();
  await expect(page.locator('#tab-reading')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#view-reading')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#view-fonts')).toBeVisible();

  await page.locator('#search-input').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.font-btn').first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.font-btn').nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.font-btn').nth(1)).toHaveAttribute('aria-pressed', 'true');
  // Selecting keeps focus in place, and only one font button is in the tab order.
  await expect(page.locator('.font-btn').nth(1)).toBeFocused();
  expect(await page.locator('.font-btn[tabindex="0"]').count()).toBe(1);
});

test('options page lists remembered sites and forgets them', async ({ worker, context, extensionId }) => {
  await setStorage(worker, 'local', { 'fw_site_example.com': settings({ fontSize: 19 }) });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  const item = page.locator('#site-list .list-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('example.com');

  await item.getByRole('button').click();
  await expect(page.locator('#site-list .list-empty')).toHaveCount(1);
  expect(await worker.evaluate(() => chrome.storage.local.get('fw_site_example.com'))).toEqual({});
});

test('options page validates excluded sites', async ({ worker, context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  const input = page.locator('#exclude-input');

  await input.fill('not a site');
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');

  await input.fill('https://www.Example.org/path');
  await input.press('Enter');
  await expect(page.locator('#excluded-list')).toContainText('example.org');
  expect(await worker.evaluate(() => chrome.storage.local.get('fw_excluded'))).toEqual({ fw_excluded: ['example.org'] });
});

test('welcome page opens on install', async ({ context, extensionId }) => {
  await expect
    .poll(() => context.pages().some((p) => p.url() === `chrome-extension://${extensionId}/welcome/welcome.html`))
    .toBe(true);
});
