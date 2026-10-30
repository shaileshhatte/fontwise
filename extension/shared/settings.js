/*
  settings.js — Fontwise settings model, shared by every extension context.
  Pure functions only (no browser APIs) so they can be unit-tested in Node.
  Loaded as a classic script; re-running it (re-injection) is harmless.
*/

'use strict';

(() => {
  const FW = (globalThis.Fontwise ??= {});

  FW.LIMITS = Object.freeze({
    fontSize: [12, 28],
    lineHeight: [1, 2.5],
    letterSpacing: [0, 0.15],
    wordSpacing: [0, 0.4],
    paragraphSpacing: [0, 3],
    marginWidth: [0, 25],
    lineLength: [45, 100],
  });

  FW.CHOICES = Object.freeze({
    fontWeight: [300, 400, 500, 600, 700],
    fontStyle: ['normal', 'italic'],
    textAlign: ['left', 'justify'],
    theme: ['light', 'sepia', 'dark', 'contrast', 'custom'],
  });

  // Ordered from narrowest to broadest; the narrowest stored layer wins.
  FW.SCOPES = Object.freeze(['tab', 'site', 'global']);

  // null means "leave the page's own value alone".
  FW.DEFAULT_SETTINGS = Object.freeze({
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
  });

  FW.DEFAULT_PREFS = Object.freeze({
    defaultScope: 'site',
    autoDark: Object.freeze({ mode: 'off', start: '21:00', end: '07:00' }),
  });

  FW.THEMES = Object.freeze({
    light: { bgColor: '#fbfaf7', textColor: '#1d1d1f', linkColor: '#0b57d0' },
    sepia: { bgColor: '#f4ecd8', textColor: '#433422', linkColor: '#8a4b08' },
    dark: { bgColor: '#1e1e1e', textColor: '#e2e2e2', linkColor: '#8ab4f8' },
    contrast: { bgColor: '#000000', textColor: '#ffffff', linkColor: '#ffd400' },
  });

  /*
    One-click presets, based on WCAG 2.2 SC 1.4.12 (text spacing), the British
    Dyslexia Association style guide and long-form typography practice:
    18–19px text, 1.6–1.8 line height, 65–75 character lines, left-aligned,
    softened contrast. `fonts` is a priority list of catalogue ids.
  */
  FW.PRESETS = Object.freeze({
    best: {
      fonts: ['atkinson-hyperlegible', 'inter', 'segoe-ui', 'roboto', 'open-sans', 'verdana'],
      fallback: 'system-sans',
      values: {
        fontSize: 18,
        lineHeight: 1.6,
        letterSpacing: 0.01,
        paragraphSpacing: 1.5,
        lineLength: 75,
        fontWeight: 400,
        fontStyle: 'normal',
        textAlign: 'left',
        theme: 'light',
      },
    },
    dyslexia: {
      fonts: ['opendyslexic', 'lexend', 'atkinson-hyperlegible', 'verdana'],
      fallback: 'system-sans',
      values: {
        fontSize: 19,
        lineHeight: 1.8,
        letterSpacing: 0.08,
        wordSpacing: 0.16,
        paragraphSpacing: 2,
        lineLength: 65,
        fontWeight: 400,
        fontStyle: 'normal',
        textAlign: 'left',
        theme: 'sepia',
      },
    },
    night: {
      fonts: ['charter', 'iowan-old-style', 'literata', 'georgia'],
      fallback: 'system-serif',
      values: {
        fontSize: 18,
        lineHeight: 1.7,
        letterSpacing: 0.01,
        paragraphSpacing: 1.5,
        lineLength: 70,
        fontWeight: 400,
        fontStyle: 'normal',
        textAlign: 'left',
        theme: 'dark',
      },
    },
  });

  const HEX = /^#[0-9a-f]{6}$/i;
  const STACK = /^[\w\s"',.-]+$/;
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const CATEGORIES = ['sans-serif', 'serif', 'monospace'];

  FW.isHexColor = (value) => typeof value === 'string' && HEX.test(value);
  FW.isFontStack = (value) => typeof value === 'string' && value.length <= 600 && STACK.test(value);
  FW.isHostname = (value) => typeof value === 'string' && value.length <= 253 && /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(value);

  FW.hasOverrides = (s) =>
    !!s &&
    Object.entries(FW.DEFAULT_SETTINGS).some(
      ([key, fallback]) => key !== 'enabled' && key !== 'keepCodeMono' && s[key] != null && s[key] !== fallback,
    );

  /** Returns a clean settings object, or null when `raw` is not an object. Never trust stored or imported data. */
  FW.sanitizeSettings = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const out = { ...FW.DEFAULT_SETTINGS };
    out.enabled = raw.enabled !== false;
    out.keepCodeMono = raw.keepCodeMono !== false;
    out.readingRuler = raw.readingRuler === true;

    for (const [key, [min, max]] of Object.entries(FW.LIMITS)) {
      const value = raw[key];
      out[key] = typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
    }
    for (const [key, allowed] of Object.entries(FW.CHOICES)) {
      out[key] = allowed.includes(raw[key]) ? raw[key] : null;
    }
    for (const key of ['textColor', 'bgColor', 'linkColor']) {
      out[key] = FW.isHexColor(raw[key]) ? raw[key].toLowerCase() : null;
    }

    const font = raw.font;
    out.font =
      font && typeof font === 'object' && FW.isFontStack(font.stack) && typeof font.name === 'string'
        ? {
            id: String(font.id ?? '').slice(0, 60),
            name: font.name.slice(0, 60),
            stack: font.stack,
            category: CATEGORIES.includes(font.category) ? font.category : 'sans-serif',
          }
        : null;
    return out;
  };

  FW.sanitizePrefs = (raw) => {
    const prefs = raw && typeof raw === 'object' ? raw : {};
    const dark = prefs.autoDark && typeof prefs.autoDark === 'object' ? prefs.autoDark : {};
    return {
      defaultScope: FW.SCOPES.includes(prefs.defaultScope) ? prefs.defaultScope : FW.DEFAULT_PREFS.defaultScope,
      autoDark: {
        mode: ['off', 'system', 'schedule'].includes(dark.mode) ? dark.mode : 'off',
        start: TIME.test(dark.start) ? dark.start : FW.DEFAULT_PREFS.autoDark.start,
        end: TIME.test(dark.end) ? dark.end : FW.DEFAULT_PREFS.autoDark.end,
      },
    };
  };

  /** Hostname used for per-site settings, or null for pages Fontwise cannot restyle. */
  FW.siteKey = (url) => {
    try {
      const { protocol, hostname } = new URL(url);
      if (protocol !== 'http:' && protocol !== 'https:') return null;
      return hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  };

  /** Picks the effective layer: tab, then site, then the Everywhere layer unless the site is excluded. */
  FW.resolve = ({ tab = null, site = null, global = null, excluded = false } = {}) => {
    if (tab) return { settings: tab, scope: 'tab' };
    if (site) return { settings: site, scope: 'site' };
    if (global && !excluded) return { settings: global, scope: 'global' };
    return { settings: null, scope: null };
  };

  FW.themeColors = (id) => {
    const { textColor, bgColor, linkColor } = FW.THEMES[id];
    return { theme: id, textColor, bgColor, linkColor };
  };

  FW.withNightColors = (s) => (s.theme === 'dark' || s.theme === 'contrast' ? s : { ...s, ...FW.themeColors('dark') });

  const toMinutes = (hhmm) => {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return hours * 60 + minutes;
  };

  FW.isNight = (autoDark, date = new Date(), prefersDark = false) => {
    if (!autoDark || autoDark.mode === 'off') return false;
    if (autoDark.mode === 'system') return prefersDark;
    const now = date.getHours() * 60 + date.getMinutes();
    const start = toMinutes(autoDark.start);
    const end = toMinutes(autoDark.end);
    return start <= end ? now >= start && now < end : now >= start || now < end;
  };

  /** Milliseconds until a scheduled dark period starts or ends, or null when no schedule is set. */
  FW.msUntilNightChange = (autoDark, date = new Date()) => {
    if (autoDark?.mode !== 'schedule') return null;
    const now = date.getHours() * 60 + date.getMinutes();
    const minutes = Math.min(
      ...[autoDark.start, autoDark.end].map((time) => (toMinutes(time) - now + 1440) % 1440 || 1440),
    );
    return minutes * 60000 - date.getSeconds() * 1000 - date.getMilliseconds();
  };

  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  /** WCAG 2.x contrast ratio between two #rrggbb colours (1–21). */
  FW.contrastRatio = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };

  FW.contrastLevel = (ratio) => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA-large' : 'fail');

  /** Dark or light text, whichever reads better on `bg`. */
  FW.readableTextOn = (bg) =>
    FW.contrastRatio(bg, '#1d1d1f') >= FW.contrastRatio(bg, '#e2e2e2') ? '#1d1d1f' : '#e2e2e2';

  FW.fontRef = (font) => (font ? { id: font.id, name: font.name, stack: font.stack, category: font.category } : null);

  /** A user preset { id, name, settings, createdAt }, or null if `raw` is invalid. */
  FW.sanitizePreset = (raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !/^[a-z0-9]{1,24}$/.test(String(raw.id))) {
      return null;
    }
    const name = raw.name.trim().slice(0, 40);
    const settings = FW.sanitizeSettings(raw.settings);
    if (!name || !settings) return null;
    return { id: String(raw.id), name, settings, createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0 };
  };

  /** Settings for a built-in preset; `findFont(id)` returns an available catalogue font or null. */
  FW.buildPreset = (preset, findFont, keepCodeMono = true) => {
    const font = preset.fonts.map(findFont).find(Boolean) ?? findFont(preset.fallback);
    return {
      ...FW.DEFAULT_SETTINGS,
      ...preset.values,
      ...FW.themeColors(preset.values.theme),
      font: FW.fontRef(font),
      keepCodeMono,
    };
  };
})();
