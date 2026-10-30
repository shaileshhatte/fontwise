/*
  i18n.js — translations for extension pages. Elements declare their text with
  data-i18n (textContent), data-i18n-title, data-i18n-label (aria-label) and
  data-i18n-placeholder; strings live in _locales/<lang>/messages.json.
*/

'use strict';

(() => {
  const FW = (globalThis.Fontwise ??= {});
  const ext = globalThis.browser ?? globalThis.chrome;

  FW.t = (key, substitutions) => ext.i18n.getMessage(key, substitutions) || key;

  const THEME_KEYS = { light: 'themeLight', sepia: 'themeSepia', dark: 'themeDark', contrast: 'themeContrast', custom: 'themeCustom' };

  FW.themeLabel = (id) => FW.t(THEME_KEYS[id] ?? 'valueDefault');

  const COMMAND_KEYS = {
    _execute_action: 'cmdOpenPopup',
    'toggle-fontwise': 'cmdToggle',
    'apply-best': 'cmdBest',
    'toggle-focus-mode': 'cmdFocus',
  };

  FW.commandLabel = (command) =>
    COMMAND_KEYS[command.name] ? FW.t(COMMAND_KEYS[command.name]) : command.description || command.name;

  /** Short human summary such as "Atkinson Hyperlegible · 18px · Sepia". */
  FW.describeSettings = (s) => {
    const parts = [
      s.font?.name,
      s.fontSize != null && `${s.fontSize}px`,
      s.lineHeight != null && FW.t('summaryLine', [String(s.lineHeight)]),
      s.theme && FW.themeLabel(s.theme),
      s.readingRuler && FW.t('readingRuler'),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : FW.t('summaryCustom');
  };

  const ATTRIBUTES = [
    ['data-i18n-title', 'title'],
    ['data-i18n-label', 'aria-label'],
    ['data-i18n-placeholder', 'placeholder'],
  ];

  FW.localize = (root = document) => {
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = FW.t(el.getAttribute('data-i18n'));
    for (const [source, attribute] of ATTRIBUTES) {
      for (const el of root.querySelectorAll(`[${source}]`)) el.setAttribute(attribute, FW.t(el.getAttribute(source)));
    }
    document.documentElement.lang = ext.i18n.getUILanguage();
    document.documentElement.dir = FW.t('@@bidi_dir');
  };
})();
