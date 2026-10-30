import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, readJson, ROOT, SHARED, fakeExtension } from './helpers.js';

const FW = load(SHARED);
const manifest = readJson('manifest.json');
const messages = readJson('_locales/en/messages.json');
const extensionDir = fileURLToPath(ROOT);

test('catalogue ids are unique and stacks pass the content-script validator', () => {
  const all = [...FW.SYSTEM_FONTS, ...FW.FONT_CATALOG];
  assert.equal(new Set(all.map((font) => font.id)).size, all.length);
  for (const font of all) {
    assert.ok(FW.isFontStack(font.stack), font.id);
    assert.ok(['sans-serif', 'serif', 'monospace'].includes(font.category), font.id);
  }
});

test('every bundled family in the catalogue ships its font files', () => {
  const families = new Set(FW.BUNDLED_FONTS.map((font) => font.family));
  for (const font of FW.FONT_CATALOG.filter((f) => f.bundled)) {
    assert.ok(families.has(font.bundled), font.bundled);
  }
  for (const face of FW.BUNDLED_FONTS.flatMap((font) => font.faces)) {
    assert.ok(existsSync(new URL(face.file, ROOT)), face.file);
  }
});

test('preset fonts exist in the catalogue', () => {
  const ids = new Set([...FW.SYSTEM_FONTS, ...FW.FONT_CATALOG].map((font) => font.id));
  for (const [name, preset] of Object.entries(FW.PRESETS)) {
    for (const id of [...preset.fonts, preset.fallback]) assert.ok(ids.has(id), `${name}: ${id}`);
  }
});

test('availableFonts always includes system and bundled fonts', () => {
  const fonts = FW.availableFonts([]);
  assert.ok(fonts.some((font) => font.id === 'system-sans'));
  assert.ok(fonts.some((font) => font.id === 'opendyslexic'));
  assert.ok(!fonts.some((font) => font.id === 'georgia'));
  assert.ok(FW.availableFonts(['georgia']).some((font) => font.id === 'georgia'));
});

test('manifest content scripts match the injection list in store.js', () => {
  const store = load(['shared/settings.js', 'shared/store.js'], { chrome: fakeExtension() });
  const declared = manifest.content_scripts[0].js.map((file) => `/${file}`);
  assert.deepEqual([...store.CONTENT_SCRIPTS], declared);
});

test('Firefox background scripts and service worker importScripts agree', () => {
  const background = readFileSync(new URL('scripts/background.js', ROOT), 'utf8');
  const imported = [...background.matchAll(/'\/(shared\/[\w-]+\.js)'/g)].map((m) => m[1]);
  assert.deepEqual([...imported, 'scripts/background.js'], manifest.background.scripts);
});

test('every file referenced by the manifest exists', () => {
  const files = [
    ...Object.values(manifest.icons),
    manifest.action.default_popup,
    manifest.options_ui.page,
    manifest.background.service_worker,
    ...manifest.background.scripts,
    ...manifest.content_scripts.flatMap((script) => script.js),
  ];
  for (const file of files) assert.ok(existsSync(new URL(file, ROOT)), file);
});

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ['vendor', 'fonts', 'icons'].includes(name) ? [] : walk(path);
    return /\.(js|html|json)$/.test(name) ? [path] : [];
  });
}

test('every i18n key used in the extension exists in the English locale', () => {
  const used = new Set();
  for (const file of walk(extensionDir)) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of [
      /data-i18n(?:-title|-label|-placeholder)?="(\w+)"/g,
      /\bt\(\s*'(\w+)'/g,
      /getMessage\(\s*'(\w+)'/g,
      /__MSG_(\w+)__/g,
      /(?:labelKey|THEME_KEYS|COMMAND_KEYS|SCRIPT_LABEL)[^;]*?'((?:category|theme|cmd|script)[A-Z]\w+)'/g,
    ]) {
      for (const match of source.matchAll(pattern)) used.add(match[1]);
    }
  }
  for (const scope of FW.SCOPES) used.add(`resetTitle_${scope}`).add(`resetNowUsing_${scope}`);
  for (const level of ['AAA', 'AA', 'AA_large', 'fail']) used.add(`contrast_${level}`);
  for (const [, nameKey] of [...readFileSync(new URL('popup/popup.js', ROOT), 'utf8').matchAll(/'#[0-9a-f]{6}', '(\w+)'/g)]) {
    used.add(nameKey);
  }

  const missing = [...used].filter((key) => !(key in messages));
  assert.deepEqual(missing, []);
});

test('locale strings respect store limits', () => {
  assert.ok(messages.extFullName.message.length <= 75);
  assert.ok(messages.extDescription.message.length <= 132);
  assert.ok(messages.badgeOn.message.length <= 4);
});
