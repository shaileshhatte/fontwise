import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, SHARED } from './helpers.js';

const FW = load(SHARED);

test('sanitizeSettings rejects non-objects', () => {
  assert.equal(FW.sanitizeSettings(null), null);
  assert.equal(FW.sanitizeSettings('x'), null);
});

test('sanitizeSettings clamps numbers and drops invalid values', () => {
  const s = FW.sanitizeSettings({
    fontSize: 400,
    lineHeight: Number.NaN,
    letterSpacing: '0.1',
    lineLength: 10,
    fontWeight: 450,
    theme: 'neon',
    textAlign: 'center',
    textColor: 'red',
    bgColor: '#ABCDEF',
    readingRuler: 'yes',
  });
  assert.equal(s.fontSize, 28);
  assert.equal(s.lineHeight, null);
  assert.equal(s.letterSpacing, null);
  assert.equal(s.lineLength, 45);
  assert.equal(s.fontWeight, null);
  assert.equal(s.theme, null);
  assert.equal(s.textAlign, null);
  assert.equal(s.textColor, null);
  assert.equal(s.bgColor, '#abcdef');
  assert.equal(s.readingRuler, false);
  assert.equal(s.enabled, true);
});

test('sanitizeSettings refuses font stacks that could break out of CSS', () => {
  for (const stack of ['Arial; } body { display: none', 'x</style><script>', 'url(http://x)', 'a'.repeat(601)]) {
    assert.equal(FW.sanitizeSettings({ font: { name: 'X', stack } }).font, null, stack);
  }
  const ok = FW.sanitizeSettings({ font: { id: 'inter', name: 'Inter', stack: '"Inter", sans-serif', category: 'nope' } });
  assert.deepEqual(plain(ok.font), { id: 'inter', name: 'Inter', stack: '"Inter", sans-serif', category: 'sans-serif' });
});

test('hasOverrides ignores enabled and keepCodeMono', () => {
  assert.equal(FW.hasOverrides({ ...FW.DEFAULT_SETTINGS }), false);
  assert.equal(FW.hasOverrides({ ...FW.DEFAULT_SETTINGS, enabled: false, keepCodeMono: false }), false);
  assert.equal(FW.hasOverrides({ ...FW.DEFAULT_SETTINGS, fontSize: 18 }), true);
  assert.equal(FW.hasOverrides({ ...FW.DEFAULT_SETTINGS, readingRuler: true }), true);
});

test('resolve picks the narrowest layer and honours exclusions', () => {
  const [tab, site, global] = [{ n: 1 }, { n: 2 }, { n: 3 }];
  assert.equal(FW.resolve({ tab, site, global }).scope, 'tab');
  assert.equal(FW.resolve({ site, global }).scope, 'site');
  assert.equal(FW.resolve({ global }).scope, 'global');
  assert.equal(FW.resolve({ global, excluded: true }).scope, null);
  assert.equal(FW.resolve({ site, global, excluded: true }).scope, 'site');
  assert.equal(FW.resolve().settings, null);
});

test('siteKey normalises hosts and rejects non-web URLs', () => {
  assert.equal(FW.siteKey('https://www.Example.com/a?b'), 'example.com');
  assert.equal(FW.siteKey('http://news.example.co.uk:8080/'), 'news.example.co.uk');
  assert.equal(FW.siteKey('chrome://extensions'), null);
  assert.equal(FW.siteKey('about:blank'), null);
  assert.equal(FW.siteKey('not a url'), null);
  assert.equal(FW.siteKey(undefined), null);
});

test('isNight handles system mode and overnight schedules', () => {
  const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
  const overnight = { mode: 'schedule', start: '21:00', end: '07:00' };
  assert.equal(FW.isNight({ mode: 'off' }, at(23), true), false);
  assert.equal(FW.isNight({ mode: 'system' }, at(12), true), true);
  assert.equal(FW.isNight({ mode: 'system' }, at(23), false), false);
  assert.equal(FW.isNight(overnight, at(23)), true);
  assert.equal(FW.isNight(overnight, at(6, 59)), true);
  assert.equal(FW.isNight(overnight, at(7)), false);
  assert.equal(FW.isNight(overnight, at(12)), false);
  assert.equal(FW.isNight({ mode: 'schedule', start: '09:00', end: '17:00' }, at(12)), true);
});

test('msUntilNightChange points at the next boundary', () => {
  const schedule = { mode: 'schedule', start: '21:00', end: '07:00' };
  assert.equal(FW.msUntilNightChange(schedule, new Date(2026, 0, 1, 20, 59, 0)), 60_000);
  assert.equal(FW.msUntilNightChange(schedule, new Date(2026, 0, 1, 6, 0, 30)), 59 * 60_000 + 30_000);
  assert.equal(FW.msUntilNightChange({ mode: 'system' }), null);
});

test('contrast helpers follow WCAG 2.x', () => {
  assert.equal(Math.round(FW.contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(FW.contrastRatio('#777777', '#777777'), 1);
  assert.equal(FW.contrastLevel(21), 'AAA');
  assert.equal(FW.contrastLevel(5), 'AA');
  assert.equal(FW.contrastLevel(3.5), 'AA-large');
  assert.equal(FW.contrastLevel(2), 'fail');
  assert.equal(FW.readableTextOn('#ffffff'), '#1d1d1f');
  assert.equal(FW.readableTextOn('#000000'), '#e2e2e2');
  for (const theme of Object.values(FW.THEMES)) {
    assert.ok(FW.contrastRatio(theme.textColor, theme.bgColor) >= 7, `${theme.textColor} on ${theme.bgColor}`);
  }
});

test('buildPreset uses the first available font, then the fallback', () => {
  const fonts = { 'system-sans': { id: 'system-sans', name: 'System Sans', stack: 'system-ui, sans-serif', category: 'sans-serif' } };
  const preset = FW.buildPreset(FW.PRESETS.best, (id) => fonts[id] ?? null, false);
  assert.equal(preset.font.id, 'system-sans');
  assert.equal(preset.theme, 'light');
  assert.equal(preset.bgColor, FW.THEMES.light.bgColor);
  assert.equal(preset.keepCodeMono, false);
  assert.ok(FW.hasOverrides(preset));
});

test('sanitizePrefs falls back to safe defaults', () => {
  assert.deepEqual(plain(FW.sanitizePrefs({ defaultScope: 'galaxy', autoDark: { mode: 'x', start: '25:00', end: '7' } })),
    plain(FW.DEFAULT_PREFS));
  assert.equal(FW.sanitizePrefs({ autoDark: { mode: 'schedule', start: '22:30', end: '06:15' } }).autoDark.start, '22:30');
});

test('sanitizePreset validates id and name', () => {
  assert.equal(FW.sanitizePreset({ id: '../x', name: 'A', settings: {} }), null);
  assert.equal(FW.sanitizePreset({ id: 'abc', name: '   ', settings: {} }), null);
  assert.equal(FW.sanitizePreset({ id: 'abc', name: 'A', settings: null }), null);
  assert.equal(FW.sanitizePreset({ id: 'abc', name: `  ${'n'.repeat(60)} `, settings: {} }).name.length, 40);
});
