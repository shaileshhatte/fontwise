/*
  catalog.js — curated catalogue of highly readable fonts and installed-font
  detection.

  Browsers expose no portable API to enumerate system fonts, so each candidate
  is measured on a canvas against the generic families: if the rendered width
  differs from the fallback, the font is installed. Fonts with a `bundled`
  family ship with the extension and are always available. Pages that call
  detectInstalledFonts() must not load web fonts under catalogue names.
*/

'use strict';

(() => {
  const FW = (globalThis.Fontwise ??= {});

  // Bump whenever FONT_CATALOG changes so cached detection results refresh.
  FW.CATALOG_VERSION = 2;

  FW.FONT_CATEGORIES = Object.freeze([
    { id: 'sans-serif', labelKey: 'categorySans' },
    { id: 'serif', labelKey: 'categorySerif' },
    { id: 'monospace', labelKey: 'categoryMono' },
  ]);

  // Text used to detect each script; a font is only "installed" if it renders that script itself.
  const SAMPLES = {
    latin: 'mmmmmmmmmmlliWW@#&0Oo1Il',
    cjk: '永字八法あア한글漢字',
    arabic: 'ابجد هوز حطي كلمن',
    devanagari: 'कखगघ ङचछज झञटठ',
    hebrew: 'אבגד הוזח טיכל',
  };

  const FALLBACKS = {
    'sans-serif': 'system-ui, "Helvetica Neue", Arial, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    monospace: 'Menlo, Consolas, "Liberation Mono", monospace',
  };

  // Always available: the OS default faces behind the CSS generic families.
  FW.SYSTEM_FONTS = Object.freeze([
    {
      id: 'system-sans',
      name: 'System Sans',
      category: 'sans-serif',
      stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      tags: ['default'],
    },
    {
      id: 'system-serif',
      name: 'System Serif',
      category: 'serif',
      stack: 'ui-serif, Georgia, "Times New Roman", serif',
      tags: ['default'],
    },
    {
      id: 'system-mono',
      name: 'System Mono',
      category: 'monospace',
      stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      tags: ['default'],
    },
  ]);

  FW.FONT_CATALOG = (() => {
    const define = (category) => (name, { detect = [name], tags = [], script = 'latin', bundled = null } = {}) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name,
      category,
      detect,
      script,
      bundled,
      tags: [...tags, ...(bundled ? ['bundled'] : []), ...(script === 'latin' ? [] : [script])],
      stack: [...detect, ...(bundled ? [bundled] : [])].map((family) => `"${family}"`).join(', ') + `, ${FALLBACKS[category]}`,
    });

    const sans = define('sans-serif');
    const serif = define('serif');
    const mono = define('monospace');
    const dyslexia = ['dyslexia'];

    return Object.freeze([
      sans('Atkinson Hyperlegible', {
        detect: ['Atkinson Hyperlegible', 'Atkinson Hyperlegible Next'],
        tags: dyslexia,
        bundled: 'Fontwise Atkinson Hyperlegible',
      }),
      sans('Lexend', { tags: dyslexia, bundled: 'Fontwise Lexend' }),
      sans('OpenDyslexic', { detect: ['OpenDyslexic', 'OpenDyslexic3'], tags: dyslexia, bundled: 'Fontwise OpenDyslexic' }),
      sans('Inter', { detect: ['Inter', 'Inter Variable'] }),
      sans('Segoe UI'),
      sans('Roboto'),
      sans('Open Sans'),
      sans('Noto Sans'),
      sans('Source Sans', { detect: ['Source Sans 3', 'Source Sans Pro'] }),
      sans('Lato'),
      sans('IBM Plex Sans'),
      sans('Fira Sans'),
      sans('Ubuntu'),
      sans('Cantarell'),
      sans('PT Sans'),
      sans('Helvetica Neue', { detect: ['Helvetica Neue', 'Helvetica'] }),
      sans('Avenir Next', { detect: ['Avenir Next', 'Avenir'] }),
      sans('Seravek'),
      sans('Verdana'),
      sans('Tahoma'),
      sans('Calibri'),
      sans('Trebuchet MS'),
      sans('Arial'),
      sans('Lucida Grande'),
      sans('DejaVu Sans'),
      sans('Liberation Sans'),

      sans('PingFang', { detect: ['PingFang SC', 'PingFang TC', 'PingFang HK'], script: 'cjk' }),
      sans('Hiragino Sans', { detect: ['Hiragino Sans', 'Hiragino Kaku Gothic ProN'], script: 'cjk' }),
      sans('Microsoft YaHei', { detect: ['Microsoft YaHei', 'Microsoft JhengHei'], script: 'cjk' }),
      sans('Noto Sans CJK', {
        detect: ['Noto Sans CJK SC', 'Noto Sans SC', 'Noto Sans CJK JP', 'Noto Sans JP', 'Noto Sans CJK KR', 'Noto Sans KR', 'Source Han Sans SC'],
        script: 'cjk',
      }),
      sans('Yu Gothic', { detect: ['Yu Gothic', 'YuGothic'], script: 'cjk' }),
      sans('Meiryo', { script: 'cjk' }),
      sans('Apple SD Gothic Neo', { script: 'cjk' }),
      sans('Malgun Gothic', { script: 'cjk' }),
      sans('Noto Sans Arabic', { script: 'arabic' }),
      sans('Geeza Pro', { script: 'arabic' }),
      sans('Noto Sans Devanagari', { script: 'devanagari' }),
      sans('Kohinoor Devanagari', { script: 'devanagari' }),
      sans('Nirmala UI', { script: 'devanagari' }),
      sans('Noto Sans Hebrew', { script: 'hebrew' }),
      sans('Arial Hebrew', { script: 'hebrew' }),

      serif('Charter', { detect: ['Charter', 'Bitstream Charter'] }),
      serif('Iowan Old Style'),
      serif('Georgia'),
      serif('Literata', { bundled: 'Fontwise Literata' }),
      serif('Merriweather'),
      serif('Source Serif', { detect: ['Source Serif 4', 'Source Serif Pro'] }),
      serif('Noto Serif'),
      serif('PT Serif'),
      serif('IBM Plex Serif'),
      serif('Sitka Text', { detect: ['Sitka Text', 'Sitka'] }),
      serif('Cambria'),
      serif('Constantia'),
      serif('Palatino', { detect: ['Palatino Linotype', 'Palatino'] }),
      serif('Book Antiqua'),
      serif('Hoefler Text'),
      serif('Baskerville'),
      serif('Charis SIL'),
      serif('Bitter'),
      serif('DejaVu Serif'),
      serif('Liberation Serif'),
      serif('Times New Roman'),

      serif('Noto Serif CJK', {
        detect: ['Noto Serif CJK SC', 'Noto Serif SC', 'Noto Serif CJK JP', 'Noto Serif JP', 'Source Han Serif SC'],
        script: 'cjk',
      }),
      serif('Songti', { detect: ['Songti SC', 'STSong'], script: 'cjk' }),
      serif('Hiragino Mincho', { detect: ['Hiragino Mincho ProN'], script: 'cjk' }),
      serif('Yu Mincho', { detect: ['Yu Mincho', 'YuMincho'], script: 'cjk' }),
      serif('Noto Naskh Arabic', { script: 'arabic' }),
      serif('Amiri', { script: 'arabic' }),
      serif('Noto Serif Devanagari', { script: 'devanagari' }),
      serif('Noto Serif Hebrew', { script: 'hebrew' }),

      mono('SF Mono', { detect: ['SF Mono', 'SFMono-Regular'] }),
      mono('Menlo'),
      mono('Monaco'),
      mono('Consolas'),
      mono('Cascadia Code'),
      mono('Cascadia Mono'),
      mono('JetBrains Mono'),
      mono('Fira Code'),
      mono('Fira Mono'),
      mono('Source Code Pro'),
      mono('IBM Plex Mono'),
      mono('Roboto Mono'),
      mono('Ubuntu Mono'),
      mono('Noto Sans Mono'),
      mono('Hack'),
      mono('DejaVu Sans Mono'),
      mono('Liberation Mono'),
      mono('Courier New'),
    ]);
  })();

  /** Ids of catalogue fonts installed on this system (bundled fonts are skipped: they are always available). */
  FW.detectInstalledFonts = (doc = globalThis.document) => {
    // Three bases so a font identical to one generic default is still caught by the others.
    const BASES = ['monospace', 'serif', 'sans-serif'];
    const ctx = doc.createElement('canvas').getContext('2d');
    const widthOf = (family, sample) => {
      ctx.font = `72px ${family}`;
      return ctx.measureText(sample).width;
    };
    const baselines = new Map();
    const baseline = (sample) => {
      if (!baselines.has(sample)) baselines.set(sample, BASES.map((base) => widthOf(base, sample)));
      return baselines.get(sample);
    };
    const isInstalled = (family, sample) =>
      BASES.some((base, i) => widthOf(`"${family}", ${base}`, sample) !== baseline(sample)[i]);

    return FW.FONT_CATALOG.filter((font) => !font.bundled && font.detect.some((family) => isInstalled(family, SAMPLES[font.script])))
      .map((font) => font.id);
  };

  /** System defaults, bundled fonts and the installed catalogue fonts, in catalogue order. */
  FW.availableFonts = (installedIds = []) => {
    const installed = new Set(installedIds);
    return [...FW.SYSTEM_FONTS, ...FW.FONT_CATALOG.filter((font) => font.bundled || installed.has(font.id))];
  };
})();
