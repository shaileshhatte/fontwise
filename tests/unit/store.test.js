import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, fakeExtension, plain } from './helpers.js';

function setup() {
  const chrome = fakeExtension();
  const FW = load(['shared/settings.js', 'shared/catalog.js', 'shared/store.js'], { chrome });
  return { FW, chrome, local: chrome.storage.local.data, sync: chrome.storage.sync.data, session: chrome.storage.session.data };
}

const page = { id: 7, url: 'https://www.example.com/article', incognito: false };
const s = (FW, patch) => ({ ...FW.DEFAULT_SETTINGS, ...patch });

test('write stores each scope in its own area', async () => {
  const { FW, local, session } = setup();
  await FW.store.write('tab', page, 'example.com', s(FW, { fontSize: 18 }));
  await FW.store.write('site', page, 'example.com', s(FW, { fontSize: 19 }));
  await FW.store.write('global', page, 'example.com', s(FW, { fontSize: 20 }));
  assert.equal(session.fw_tab_7.fontSize, 18);
  assert.equal(local['fw_site_example.com'].fontSize, 19);
  assert.equal(local.fw_global.fontSize, 20);
});

test('settings without overrides remove the layer', async () => {
  const { FW, local } = setup();
  await FW.store.write('site', page, 'example.com', s(FW, { fontSize: 18 }));
  await FW.store.write('site', page, 'example.com', s(FW, {}));
  assert.equal('fw_site_example.com' in local, false);
});

test('private windows never write site settings', async () => {
  const { FW, local } = setup();
  const saved = await FW.store.write('site', { ...page, incognito: true }, 'example.com', s(FW, { fontSize: 18 }));
  assert.equal(saved, false);
  assert.deepEqual(Object.keys(local), []);
  assert.equal(FW.store.defaultScope(FW.DEFAULT_PREFS, { ...page, incognito: true }, 'example.com'), 'tab');
  assert.equal(FW.store.defaultScope(FW.DEFAULT_PREFS, page, null), 'tab');
  assert.equal(FW.store.defaultScope(FW.DEFAULT_PREFS, page, 'example.com'), 'site');
});

test('effective resolves layers and moveTo clears narrower ones', async () => {
  const { FW, session } = setup();
  await FW.store.write('tab', page, 'example.com', s(FW, { fontSize: 18 }));
  await FW.store.write('global', page, 'example.com', s(FW, { fontSize: 20 }));
  assert.equal((await FW.store.effective(page)).scope, 'tab');

  await FW.store.moveTo('global', page, 'example.com', s(FW, { fontSize: 22 }));
  assert.equal('fw_tab_7' in session, false);
  const effective = await FW.store.effective(page);
  assert.equal(effective.scope, 'global');
  assert.equal(effective.settings.fontSize, 22);
  assert.equal(effective.host, 'example.com');
});

test('excluded sites skip the Everywhere layer but keep their own', async () => {
  const { FW } = setup();
  await FW.store.write('global', page, 'example.com', s(FW, { fontSize: 20 }));
  await FW.store.setExcluded(['example.com', 'bad host!', 'EXAMPLE.org']);
  assert.deepEqual(plain(await FW.store.excluded()), ['example.com', 'example.org']);
  assert.equal((await FW.store.effective(page)).settings, null);
  await FW.store.write('site', page, 'example.com', s(FW, { fontSize: 17 }));
  assert.equal((await FW.store.effective(page)).settings.fontSize, 17);
});

test('snapshot resolves many tabs from one read', async () => {
  const { FW } = setup();
  await FW.store.write('global', page, null, s(FW, { fontSize: 20 }));
  await FW.store.write('site', page, 'example.com', s(FW, { fontSize: 17 }));
  const snapshot = await FW.store.snapshot();
  assert.equal(snapshot.effective(page).fontSize, 17);
  assert.equal(snapshot.effective({ id: 9, url: 'https://other.org/' }).fontSize, 20);
});

test('sync moves portable data only, and back again', async () => {
  const { FW, local, sync } = setup();
  await FW.store.write('global', page, null, s(FW, { fontSize: 20 }));
  await FW.store.write('site', page, 'example.com', s(FW, { fontSize: 17 }));
  await FW.store.setPrefs({ defaultScope: 'global' });
  await FW.store.savePreset('Evening', s(FW, { fontSize: 21 }));

  await FW.store.setSync(true);
  assert.ok('fw_global' in sync && 'fw_prefs' in sync);
  assert.equal(Object.keys(sync).filter((key) => key.startsWith('fw_preset_')).length, 1);
  assert.equal('fw_global' in local, false);
  assert.ok('fw_site_example.com' in local);
  assert.equal((await FW.store.prefs()).defaultScope, 'global');

  await FW.store.setSync(false);
  assert.ok('fw_global' in local);
  assert.equal((await FW.store.globalSettings()).fontSize, 20);
});

test('presets are saved, listed in order and deleted', async () => {
  const { FW } = setup();
  const first = await FW.store.savePreset('A', s(FW, { fontSize: 18 }));
  await FW.store.savePreset('B', s(FW, { fontSize: 19 }));
  assert.deepEqual(plain((await FW.store.presets()).map((p) => p.name)), ['A', 'B']);
  await FW.store.deletePreset(first.id);
  assert.deepEqual(plain((await FW.store.presets()).map((p) => p.name)), ['B']);
});

test('export and import round-trip, and imports are validated', async () => {
  const { FW } = setup();
  await FW.store.write('site', page, 'example.com', s(FW, { fontSize: 17 }));
  await FW.store.write('global', page, null, s(FW, { fontSize: 20 }));
  await FW.store.savePreset('A', s(FW, { fontSize: 18 }));
  const backup = await FW.store.exportData();

  const fresh = setup();
  const result = await fresh.FW.store.importData(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(plain(result), { presets: 1, sites: 1, global: true });
  assert.equal((await fresh.FW.store.effective(page)).settings.fontSize, 17);

  await assert.rejects(fresh.FW.store.importData({ app: 'other' }));
  const hostile = await fresh.FW.store.importData({
    app: 'fontwise',
    format: 1,
    sites: { 'evil host': { fontSize: 18 }, 'ok.com': { font: { name: 'x', stack: '}</style>' } } },
    presets: [{ id: '../../x', name: 'bad', settings: {} }],
  });
  assert.deepEqual(plain(hostile), { presets: 0, sites: 0, global: false });
});

test('font cache refreshes when the catalogue version changes', async () => {
  const { FW, local } = setup();
  let scans = 0;
  const detect = () => (scans++, ['georgia']);
  assert.deepEqual(plain(await FW.store.installedFontIds({ detect })), ['georgia']);
  await FW.store.installedFontIds({ detect });
  assert.equal(scans, 1);
  local.fw_font_cache.catalogVersion = -1;
  await FW.store.installedFontIds({ detect });
  assert.equal(scans, 2);
});
