import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, SHARED } from './helpers.js';

const FW = load(SHARED);
const urlFor = (file) => `chrome-extension://id/${file}`;
const base = (patch) => ({ ...FW.DEFAULT_SETTINGS, ...patch });

test('no CSS for missing, empty or paused settings', () => {
  assert.equal(FW.buildCss(null), '');
  assert.equal(FW.buildCss(base({})), '');
  assert.equal(FW.buildCss(base({ fontSize: 18, enabled: false })), '');
});

test('every rule is scoped under :root and uses !important', () => {
  const css = FW.buildCss(base({
    font: { id: 'x', name: 'X', stack: 'Georgia, serif', category: 'serif' },
    fontSize: 18, lineHeight: 1.6, paragraphSpacing: 1.5, lineLength: 70, marginWidth: 10,
    fontWeight: 500, fontStyle: 'italic', textAlign: 'justify', ...FW.themeColors('sepia'),
  }));
  for (const rule of css.split('\n')) {
    assert.match(rule, /^:root/, rule);
    assert.match(rule, /!important/, rule);
  }
  assert.match(css, /font-size: 18px/);
  assert.match(css, /max-width: 70ch/);
  assert.match(css, /hyphens: auto/);
  assert.match(css, /padding-inline: 10%/);
});

test('unvalidated values never reach the stylesheet', () => {
  const css = FW.buildCss({
    enabled: true,
    fontSize: '18px; } body { display: none',
    textColor: 'red; } * { color: red',
    bgColor: 'url(javascript:alert(1))',
    textAlign: 'center; }',
    font: { name: 'Evil', stack: 'x; } body { display: none; }' },
    lineHeight: 1.5,
  });
  assert.doesNotMatch(css, /display: none|javascript|red|center/);
  assert.match(css, /line-height: 1.5/);
});

test('code stays monospace unless disabled', () => {
  const font = { id: 'x', name: 'X', stack: 'Georgia, serif', category: 'serif' };
  assert.match(FW.buildCss(base({ font })), /pre \*/);
  assert.doesNotMatch(FW.buildCss(base({ font, keepCodeMono: false })), /pre \*/);
});

test('bundled fonts get @font-face rules with extension URLs', () => {
  const atkinson = FW.FONT_CATALOG.find((font) => font.id === 'atkinson-hyperlegible');
  const css = FW.buildCss(base({ font: FW.fontRef(atkinson) }), { urlFor });
  assert.match(css, /@font-face \{ font-family: "Fontwise Atkinson Hyperlegible"; src: url\("chrome-extension:\/\/id\/fonts\//);
  assert.match(css, /unicode-range/);
  assert.equal(FW.fontFaceCss('Georgia, serif', urlFor), '');
  assert.doesNotMatch(FW.buildCss(base({ font: FW.fontRef(atkinson) })), /@font-face/);
});

test('forced colours mode leaves colours to the operating system', () => {
  const css = FW.buildCss(base({ fontSize: 18, ...FW.themeColors('dark') }), { forcedColors: true });
  assert.match(css, /font-size/);
  assert.doesNotMatch(css, /background-color|color:/);
});

test('night mode switches light themes to dark colours only', () => {
  const night = FW.buildCss(base(FW.themeColors('light')), { night: true });
  assert.match(night, new RegExp(FW.THEMES.dark.bgColor));
  const contrast = FW.buildCss(base(FW.themeColors('contrast')), { night: true });
  assert.match(contrast, /#000000/);
  const noColours = FW.buildCss(base({ fontSize: 18 }), { night: true });
  assert.match(noColours, new RegExp(FW.THEMES.dark.bgColor));
});

test('custom text colour without link colour keeps links underlined', () => {
  assert.match(FW.buildCss(base({ textColor: '#333333' })), /text-decoration: underline/);
});

test('Fontwise overlays are excluded from page rules', () => {
  const css = FW.buildCss(base({ bgColor: '#000000', textColor: '#ffffff' }));
  assert.match(css, /fontwise-reader/);
  assert.match(css, /fontwise-ruler/);
});

test('reader CSS is complete for empty and full settings', () => {
  for (const settings of [null, base({}), base({ fontSize: 22, lineLength: 60, ...FW.themeColors('sepia') })]) {
    const css = FW.readerCss(settings, { prefersDark: true });
    assert.doesNotMatch(css, /undefined|null|NaN/);
    assert.match(css, /prefers-reduced-motion/);
  }
  assert.match(FW.readerCss(base({ lineLength: 60 })), /max-width: 60ch/);
  assert.match(FW.readerCss(null, { forcedColors: true }), /Canvas/);
});
