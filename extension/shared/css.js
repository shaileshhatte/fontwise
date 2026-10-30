/*
  css.js — turns Fontwise settings into CSS text. Every value is re-validated
  through Fontwise.sanitizeSettings because it ends up inside a stylesheet.
  Pure functions only, so they can be unit-tested in Node.
*/

'use strict';

(() => {
  const FW = (globalThis.Fontwise ??= {});

  // Fontwise's own overlay hosts must never be restyled by the page rules.
  const HOSTS = 'fontwise-ruler, fontwise-reader, fontwise-toast';
  const TEXT = 'body, p, li, dd, dt, blockquote, figcaption, td, th, article, section, main, label, summary, caption';
  // th, label, summary and caption are left out so their own emphasis survives.
  const WEIGHTED = 'body, p, li, dd, dt, blockquote, figcaption, td, article, section, main';
  const PARAGRAPHS = 'p, li, dd, dt, blockquote, figcaption';
  const MEDIA = `img, video, picture, canvas, svg, svg *, iframe, embed, object, ${HOSTS}`;

  // Icon fonts are usually set on the element itself, so overriding them breaks the glyph.
  const ICONS = [
    'svg', 'svg *', 'math', 'math *', HOSTS,
    ':empty:not(input, textarea)', 'i[class]',
    '[class*="icon" i]', '[class*="glyph" i]',
    '[class*="material-icons"]', '[class*="material-symbols"]',
    '.fa', '[class^="fa-"]', '[class*=" fa-"]',
    '.bi', '[class^="bi-"]', '[class*=" bi-"]',
    '[class^="ri-"]', '[class*=" ri-"]',
    '[class*="codicon"]', '[data-icon]',
  ].join(', ');

  const CODE = [
    'pre', 'pre *', 'code', 'code *', 'kbd', 'kbd *', 'samp', 'samp *', 'tt',
    '.monaco-editor', '.monaco-editor *', '.CodeMirror', '.CodeMirror *',
    '.cm-editor', '.cm-editor *', '.ace_editor', '.ace_editor *',
  ].join(', ');

  FW.READER_FONT = '"Literata", "Fontwise Literata", Charter, Georgia, serif';

  const scope = (list) => list.split(',').map((s) => `:root ${s.trim()}`).join(', ');

  /** @font-face rules for every bundled family referenced in `stack`; `urlFor(file)` returns the extension URL. */
  FW.fontFaceCss = (stack, urlFor) =>
    (FW.BUNDLED_FONTS ?? [])
      .filter((font) => typeof stack === 'string' && stack.includes(`"${font.family}"`))
      .flatMap((font) =>
        font.faces.map(
          (face) =>
            `@font-face { font-family: "${font.family}"; src: url("${urlFor(face.file)}") format("woff2"); ` +
            `font-weight: ${face.weight}; font-style: ${face.style}; font-display: swap;` +
            `${face.unicodeRange ? ` unicode-range: ${face.unicodeRange};` : ''} }`,
        ),
      )
      .join('\n');

  /**
   * Page stylesheet for `raw` settings.
   * @param {object} options urlFor: bundled-font URL resolver; forcedColors: OS high-contrast mode is on;
   *   night: automatic dark mode is active.
   */
  FW.buildCss = (raw, { urlFor = null, forcedColors = false, night = false } = {}) => {
    let s = FW.sanitizeSettings(raw);
    if (!s || !s.enabled) return '';
    if (night) s = FW.withNightColors(s);
    const rules = [];

    if (s.font) {
      if (urlFor) rules.push(FW.fontFaceCss(s.font.stack, urlFor));
      const skip = s.keepCodeMono ? `${ICONS}, ${CODE}` : ICONS;
      rules.push(`:root body, :root body *:not(${skip}) { font-family: ${s.font.stack} !important; }`);
    }

    const text = [];
    if (s.fontSize != null) text.push(`font-size: ${s.fontSize}px !important`);
    if (s.lineHeight != null) text.push(`line-height: ${s.lineHeight} !important`);
    if (s.letterSpacing != null) text.push(`letter-spacing: ${s.letterSpacing}em !important`);
    if (s.wordSpacing != null) text.push(`word-spacing: ${s.wordSpacing}em !important`);
    if (text.length) rules.push(`${scope(TEXT)} { ${text.join('; ')}; }`);

    const look = [];
    if (s.fontWeight != null) look.push(`font-weight: ${s.fontWeight} !important`);
    if (s.fontStyle != null) look.push(`font-style: ${s.fontStyle} !important`);
    if (look.length) rules.push(`${scope(WEIGHTED)} { ${look.join('; ')}; }`);

    if (s.paragraphSpacing != null) rules.push(`:root p { margin-bottom: ${s.paragraphSpacing}em !important; }`);
    if (s.lineLength != null) rules.push(`${scope(PARAGRAPHS)} { max-width: ${s.lineLength}ch !important; }`);

    if (s.textAlign === 'left') {
      rules.push(`${scope(PARAGRAPHS)} { text-align: start !important; }`);
    } else if (s.textAlign === 'justify') {
      rules.push(
        `${scope(PARAGRAPHS)} { text-align: justify !important; -webkit-hyphens: auto !important; hyphens: auto !important; }`,
      );
    }

    if (s.marginWidth != null) {
      rules.push(`:root body { padding-inline: ${s.marginWidth}% !important; box-sizing: border-box !important; }`);
    }

    // In forced-colors (Windows High Contrast) mode the OS palette must win.
    if (!forcedColors) {
      if (s.bgColor) {
        rules.push(`:root, :root body, :root body *:not(${MEDIA}) { background-color: ${s.bgColor} !important; }`);
      }
      if (s.textColor) rules.push(`:root body, :root body *:not(${MEDIA}) { color: ${s.textColor} !important; }`);
      // a[href] outranks the generic colour rule above.
      if (s.linkColor) {
        rules.push(`:root body a[href], :root body a[href] *:not(${MEDIA}) { color: ${s.linkColor} !important; }`);
      } else if (s.textColor) {
        rules.push(':root body a[href] { text-decoration: underline !important; }');
      }
    }

    return rules.filter(Boolean).join('\n');
  };

  /** Styles for the Focus mode overlay (rendered inside a closed shadow root). */
  FW.readerCss = (raw, { night = false, prefersDark = false, forcedColors = false } = {}) => {
    let s = FW.sanitizeSettings(raw) ?? { ...FW.DEFAULT_SETTINGS };
    if (!s.textColor || !s.bgColor) s = { ...s, ...FW.themeColors(prefersDark ? 'dark' : 'light') };
    if (night) s = FW.withNightColors(s);
    const link = s.linkColor ?? s.textColor;
    const colors = forcedColors
      ? 'background: Canvas; color: CanvasText;'
      : `background: ${s.bgColor}; color: ${s.textColor};`;

    // Class names are prefixed: Readability keeps its own "page" class in the article markup.
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .fw-backdrop { position: fixed; inset: 0; overflow-y: auto; overscroll-behavior: contain; ${colors}
        font-family: ${s.font?.stack ?? FW.READER_FONT}; font-size: ${s.fontSize ?? 19}px;
        line-height: ${s.lineHeight ?? 1.65}; letter-spacing: ${s.letterSpacing ?? 0}em;
        word-spacing: ${s.wordSpacing ?? 0}em; font-weight: ${s.fontWeight ?? 400};
        font-style: ${s.fontStyle ?? 'normal'}; text-align: ${s.textAlign === 'justify' ? 'justify' : 'start'};
        hyphens: ${s.textAlign === 'justify' ? 'auto' : 'manual'}; overflow-wrap: break-word;
        animation: fw-in 180ms ease-out; }
      .fw-backdrop:focus { outline: none; }
      @keyframes fw-in { from { opacity: 0; transform: translateY(8px); } }
      @media (prefers-reduced-motion: reduce) { .fw-backdrop { animation: none; } }
      .fw-bar { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 12px;
        padding: 10px max(16px, env(safe-area-inset-left)); font: 500 13px/1.4 system-ui, sans-serif;
        letter-spacing: 0; word-spacing: 0; text-align: start; ${colors}
        border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
      .fw-site { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.75; }
      .fw-time { opacity: 0.75; white-space: nowrap; }
      .fw-close { font: inherit; color: inherit; background: transparent; cursor: pointer; padding: 6px 12px;
        min-height: 32px; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 6px;
        transition: background-color 120ms ease; }
      .fw-close:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
      .fw-close:focus-visible { outline: 2px solid ${link}; outline-offset: 2px; }
      .fw-article { max-width: ${s.lineLength ?? 70}ch; margin: 0 auto; padding: clamp(20px, 5vw, 48px) 20px 120px; }
      h1 { font-size: 1.9em; line-height: 1.2; margin: 0 0 0.4em; overflow-wrap: anywhere; }
      h2, h3, h4 { line-height: 1.3; margin: 1.6em 0 0.5em; }
      .fw-byline { margin: 0 0 2em; opacity: 0.7; font-size: 0.9em; }
      ::selection { background: color-mix(in srgb, ${link} 35%, transparent); }
      p, ul, ol, blockquote, figure, pre, table { margin: 0 0 ${s.paragraphSpacing ?? 1.1}em; }
      a { color: ${link}; text-decoration: underline; }
      img, video, figure { max-width: 100%; height: auto; }
      figcaption { font-size: 0.85em; opacity: 0.75; }
      blockquote { margin-inline: 0; padding-inline-start: 1em; border-inline-start: 3px solid ${link}; }
      pre, code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.9em; }
      pre { overflow-x: auto; padding: 12px; border-radius: 6px;
        background: color-mix(in srgb, currentColor 8%, transparent); }
      table { border-collapse: collapse; display: block; overflow-x: auto; }
      td, th { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); padding: 4px 8px; }
    `;
  };
})();
