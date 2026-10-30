/*
  popup.js — Fontwise popup

  Edits one settings layer (this tab, this site or everywhere), previews
  every change live in the tab, and persists it through Fontwise.store.
  Requires the shared scripts loaded before it in popup.html.
*/

'use strict';

const ext = globalThis.browser ?? globalThis.chrome;
const FW = globalThis.Fontwise;
const { t } = FW;

const HOST_PATTERNS = ['http://*/*', 'https://*/*'];
const NO_COLORS = { theme: null, textColor: null, bgColor: null, linkColor: null };

const PALETTES = {
  textColor: [
    ['#000000', 'colourBlack'], ['#1d1d1f', 'colourInk'], ['#3a3a3a', 'colourGraphite'], ['#433422', 'colourBrown'],
    ['#1f3a5f', 'colourNavy'], ['#e2e2e2', 'colourSilver'], ['#ffffff', 'colourWhite'],
  ],
  bgColor: [
    ['#ffffff', 'colourWhite'], ['#fbfaf7', 'colourPaper'], ['#f4ecd8', 'colourCream'], ['#e8f0e3', 'colourMint'],
    ['#e6eef7', 'colourSky'], ['#1e1e1e', 'colourCharcoal'], ['#000000', 'colourBlack'],
  ],
};

const SCRIPT_LABEL = { cjk: 'scriptCjk', arabic: 'scriptArabic', devanagari: 'scriptDevanagari', hebrew: 'scriptHebrew' };

const RANGE_FORMAT = {
  fontSize: (v) => `${v}px`,
  lineHeight: (v) => v.toFixed(2),
  letterSpacing: (v) => `${v.toFixed(2)}em`,
  wordSpacing: (v) => `${v.toFixed(2)}em`,
  paragraphSpacing: (v) => `${v.toFixed(1)}em`,
  marginWidth: (v) => `${v}%`,
  lineLength: (v) => t('valueCharacters', [String(v)]),
};

// Where an untouched slider rests; typical browser defaults.
const RANGE_IDLE = {
  fontSize: 16,
  lineHeight: 1.5,
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 1,
  marginWidth: 0,
  lineLength: 100,
};

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

let tab = null;
let host = null;
let excluded = false;
let prefs = FW.sanitizePrefs(null);
let syncOn = false;
let scope = 'tab';
let settings = { ...FW.DEFAULT_SETTINGS };
let availableFonts = [];
let userPresets = [];
let activeCategory = 'all';
let searchQuery = '';
let canModify = false;
let applyPending = false;

// ─────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const dom = {
  headerSub: $('header-sub'),
  focus: $('btn-focus'),
  options: $('btn-options'),
  toggle: $('toggle-enabled'),
  scope: $('scope'),
  scopeHint: $('scope-hint'),
  reset: $('btn-reset'),
  activeBar: $('active-bar'),
  activeLabel: $('active-label'),
  notice: $('notice'),
  noticeText: $('notice-text'),
  grant: $('btn-grant'),
  presets: $('presets'),
  customPresets: $('custom-presets'),
  savePreset: $('btn-save-preset'),
  saveForm: $('save-form'),
  presetName: $('preset-name'),
  cancelPreset: $('btn-cancel-preset'),
  viewTabs: $('view-tabs'),
  search: $('search-input'),
  catTabs: $('cat-tabs'),
  fontList: $('font-list'),
  fontCount: $('font-count'),
  footerNote: $('footer-note'),
  rescan: $('btn-rescan'),
  themes: $('themes'),
  contrast: $('contrast'),
  ruler: $('toggle-ruler'),
  keepCodeMono: $('toggle-code'),
  ranges: [...document.querySelectorAll('.range[data-key]')],
  segmented: [...document.querySelectorAll('.segmented[data-key]')],
  palettes: [...document.querySelectorAll('.palette[data-key]')],
  lockable: [...document.querySelectorAll('[data-lockable]')],
};

const findFont = (id) => availableFonts.find((font) => font.id === id) ?? null;

// ─────────────────────────────────────────────
// Applying and saving
// ─────────────────────────────────────────────

// Excluded sites ignore the Everywhere layer, so editing it must not restyle them either.
const liveSettings = () => (scope === 'global' && excluded ? null : settings);

async function applyToTab() {
  if (!tab) return;
  if (!canModify) {
    applyPending = true;
    return;
  }
  try {
    await FW.store.send(tab.id, { type: 'FW_APPLY', settings: liveSettings(), autoDark: prefs.autoDark });
    await FW.store.badge(tab.id, liveSettings());
  } catch {
    setAccess(false, t('noticeRestricted'));
  }
}

// Coalesce rapid slider input; messages run strictly in order.
let applyQueued = false;
let applyChain = Promise.resolve();

function scheduleApply() {
  if (applyQueued) return;
  applyQueued = true;
  setTimeout(() => {
    applyQueued = false;
    applyChain = applyChain.then(applyToTab);
  }, 50);
}

// Persisting is debounced separately: storage.sync allows only ~120 writes a minute.
let saveTimer = 0;
let saveDirty = false;

function scheduleSave() {
  saveDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, scope === 'global' && syncOn ? 1000 : 250);
}

async function save() {
  clearTimeout(saveTimer);
  if (!saveDirty || !tab) return;
  saveDirty = false;
  try {
    await FW.store.write(scope, tab, host, { ...settings });
  } catch {
    flash(t('saveFailed'));
  }
}

function update(patch) {
  settings = { ...settings, ...patch, enabled: true };
  renderControls();
  if ('font' in patch) renderFontSelection();
  scheduleApply();
  scheduleSave();
}

function replaceSettings(next, message) {
  settings = { ...FW.DEFAULT_SETTINGS, ...next, enabled: true };
  renderControls();
  renderFontSelection();
  scheduleApply();
  scheduleSave();
  if (message) FW.announce(message);
}

// ─────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────

async function loadState() {
  host = FW.siteKey(tab?.url);
  const layers = tab ? await FW.store.layers(tab) : { tab: null, site: null, global: null, excluded: false };
  excluded = layers.excluded;
  const effective = FW.resolve(layers);
  settings = effective.settings ?? { ...FW.DEFAULT_SETTINGS };
  scope = effective.scope ? FW.store.editableScope(effective.scope, tab, host) : FW.store.defaultScope(prefs, tab, host);
  return effective.scope;
}

async function loadFonts(force = false) {
  const installedIds = await FW.store.installedFontIds({ force, detect: () => FW.detectInstalledFonts(document) });
  availableFonts = FW.availableFonts(installedIds);
}

async function loadPresets() {
  userPresets = await FW.store.presets();
}

// Bundled fonts use unique "Fontwise …" family names, so they cannot fool installed-font detection.
function injectPreviewFonts() {
  const stack = (FW.BUNDLED_FONTS ?? []).map((font) => `"${font.family}"`).join(', ');
  const style = document.createElement('style');
  style.textContent = FW.fontFaceCss(stack, (file) => ext.runtime.getURL(file));
  document.head.append(style);
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────

function setRowState(key, isSet, valueText) {
  const row = document.querySelector(`.row[data-row="${key}"]`);
  row?.classList.toggle('is-set', isSet);
  const readout = document.querySelector(`[data-value-for="${key}"]`);
  if (readout && valueText !== undefined) readout.textContent = valueText;
}

function scopeHint() {
  if (scope === 'site') return t('scopeSiteHint', [host ?? '']);
  if (scope === 'global') return excluded ? t('scopeGlobalExcluded', [host ?? '']) : t('scopeGlobalHint');
  return t('scopeTabHint');
}

function renderScope() {
  const siteBlocked = !host || !!tab?.incognito;
  for (const radio of dom.scope.querySelectorAll('[data-scope]')) {
    const on = radio.dataset.scope === scope;
    radio.setAttribute('aria-checked', String(on));
    radio.classList.toggle('active', on);
    if (radio.dataset.scope === 'site') {
      radio.disabled = siteBlocked;
      radio.title = siteBlocked ? t(tab?.incognito ? 'scopeSitePrivate' : 'scopeSiteUnavailable') : '';
    }
  }
  FW.setTabStop(dom.scope, '[data-scope]', dom.scope.querySelector('[aria-checked="true"]'));
  const hint = scopeHint();
  dom.scopeHint.textContent = hint;
  dom.footerNote.textContent = hint;
  dom.footerNote.title = hint;
  dom.footerNote.classList.toggle('warn', scope === 'global' && excluded);
  dom.reset.title = t(`resetTitle_${scope}`);
}

function renderSummary() {
  const active = FW.hasOverrides(settings);
  dom.activeBar.classList.toggle('collapsed', !active);
  dom.activeBar.inert = !active;
  if (!active) return;

  const paused = settings.enabled === false;
  dom.activeBar.firstElementChild.classList.toggle('paused', paused);
  dom.activeLabel.textContent = (paused ? `${t('summaryPaused')} · ` : '') + FW.describeSettings(settings);
}

function renderContrast() {
  const { textColor, bgColor } = settings;
  dom.contrast.hidden = !(textColor && bgColor);
  if (dom.contrast.hidden) return;
  const ratio = FW.contrastRatio(textColor, bgColor);
  const level = FW.contrastLevel(ratio);
  dom.contrast.dataset.level = level;
  dom.contrast.textContent = t(`contrast_${level.replace('-', '_')}`, [ratio.toFixed(1)]);
}

function renderControls() {
  dom.toggle.checked = settings.enabled !== false;
  dom.ruler.checked = settings.readingRuler === true;
  dom.keepCodeMono.checked = settings.keepCodeMono !== false;

  for (const input of dom.ranges) {
    const key = input.dataset.key;
    const value = settings[key];
    const shown = value ?? RANGE_IDLE[key];
    const min = Number(input.min);
    const max = Number(input.max);
    input.value = String(shown);
    input.style.setProperty('--fill', `${((shown - min) / (max - min)) * 100}%`);
    const text = value != null ? RANGE_FORMAT[key](value) : t('valueDefault');
    input.setAttribute('aria-valuetext', text);
    setRowState(key, value != null, text);
  }

  for (const group of dom.segmented) {
    const key = group.dataset.key;
    let active = null;
    for (const btn of group.querySelectorAll('button[data-value]')) {
      const value = group.dataset.type === 'number' ? Number(btn.dataset.value) : btn.dataset.value;
      const on = settings[key] === value;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      if (on) active = btn;
    }
    if (!group.contains(document.activeElement)) FW.setTabStop(group, 'button', active);
    setRowState(key, settings[key] != null);
  }

  let activeSwatch = null;
  for (const swatch of dom.themes.querySelectorAll('[data-theme]')) {
    const on = settings.theme === swatch.dataset.theme;
    swatch.classList.toggle('active', on);
    swatch.setAttribute('aria-pressed', String(on));
    if (on) activeSwatch = swatch;
  }
  if (!dom.themes.contains(document.activeElement)) FW.setTabStop(dom.themes, '[data-theme]', activeSwatch);
  setRowState('theme', settings.theme != null, FW.themeLabel(settings.theme));

  for (const palette of dom.palettes) {
    const key = palette.dataset.key;
    let active = null;
    for (const btn of palette.querySelectorAll('.palette-color')) {
      const on = btn.dataset.color === settings[key];
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      if (on) active = btn;
    }
    if (!palette.contains(document.activeElement)) FW.setTabStop(palette, '.palette-color', active);
    palette.querySelector('.color-input').value = settings[key] ?? (key === 'textColor' ? '#1d1d1f' : '#fbfaf7');
    setRowState(key, settings[key] != null);
  }

  dom.savePreset.disabled = !FW.hasOverrides(settings);
  renderContrast();
  renderSummary();
  renderScope();
}

function categoryLabel(category, count) {
  const label = document.createElement('h3');
  label.className = 'cat-label';
  label.id = `cat-${category.id}`;

  const dot = document.createElement('span');
  dot.className = 'cat-dot';
  dot.dataset.cat = category.id;
  dot.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = t(category.labelKey);

  const badge = document.createElement('span');
  badge.className = 'cat-count';
  badge.textContent = String(count);
  badge.setAttribute('aria-hidden', 'true');

  label.append(dot, text, badge);
  return label;
}

function fontBadge(font) {
  if (font.tags.includes('default')) return ['default', t('badgeDefault')];
  if (font.tags.includes('dyslexia')) return ['dyslexia', t('badgeDyslexia')];
  if (SCRIPT_LABEL[font.script]) return ['script', t(SCRIPT_LABEL[font.script])];
  if (font.bundled) return ['bundled', t('badgeBundled')];
  return null;
}

function fontButton(font) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'font-btn';
  btn.dataset.fontId = font.id;
  btn.title = font.name;
  btn.tabIndex = -1;

  const preview = document.createElement('span');
  preview.className = 'font-preview';
  preview.style.fontFamily = font.stack;
  preview.textContent = 'Aa';
  preview.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'font-name';
  name.textContent = font.name;

  btn.append(preview, name);

  const badge = fontBadge(font);
  if (badge) {
    const tag = document.createElement('span');
    tag.className = 'font-badge';
    tag.dataset.kind = badge[0];
    tag.textContent = badge[1];
    btn.append(tag);
  }
  return btn;
}

function emptyState(query) {
  const node = $('tpl-empty').content.firstElementChild.cloneNode(true);
  node.querySelector('p').textContent = query ? t('noFontsMatch', [query]) : t('noFontsCategory');
  return node;
}

function renderFontList() {
  const q = searchQuery.trim().toLowerCase();
  const matches = availableFonts.filter((font) =>
    (activeCategory === 'all' || font.category === activeCategory) &&
    (!q || font.name.toLowerCase().includes(q) || font.tags.some((tag) => tag.includes(q)) || font.category.includes(q)),
  );

  dom.fontCount.textContent = t('fontCount', [String(availableFonts.length)]);
  dom.fontList.replaceChildren();

  if (matches.length === 0) {
    dom.fontList.append(emptyState(searchQuery.trim()));
    return matches.length;
  }

  for (const category of FW.FONT_CATEGORIES) {
    const fonts = matches.filter((font) => font.category === category.id);
    if (fonts.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'cat-section';
    const grid = document.createElement('div');
    grid.className = 'font-grid';
    if (activeCategory === 'all') {
      section.append(categoryLabel(category, fonts.length));
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-labelledby', `cat-${category.id}`);
    }
    grid.append(...fonts.map(fontButton));
    section.append(grid);
    dom.fontList.append(section);
  }
  renderFontSelection();
  return matches.length;
}

/** Updates selection in place so keyboard focus is never lost. */
function renderFontSelection() {
  let selected = null;
  for (const btn of dom.fontList.querySelectorAll('.font-btn')) {
    const on = btn.dataset.fontId === settings.font?.id;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', String(on));
    if (on) selected = btn;
  }
  if (!dom.fontList.contains(document.activeElement)) FW.setTabStop(dom.fontList, '.font-btn', selected);
}

function renderPresets() {
  dom.customPresets.replaceChildren(
    ...userPresets.map((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip chip-custom';
      btn.dataset.userPreset = preset.id;
      btn.textContent = preset.name;
      btn.title = t('applyPreset', [preset.name]);
      return btn;
    }),
  );
  dom.customPresets.hidden = userPresets.length === 0;
  FW.setTabStop(dom.customPresets, '[data-user-preset]');
}

function buildPalettes() {
  for (const palette of dom.palettes) {
    const swatches = PALETTES[palette.dataset.key].map(([color, nameKey]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-color';
      btn.dataset.color = color;
      btn.title = t(nameKey);
      btn.setAttribute('aria-label', t(nameKey));
      btn.style.setProperty('--c', color);
      return btn;
    });
    palette.prepend(...swatches);
  }
  for (const btn of document.querySelectorAll('[data-reset]')) {
    const label = document.querySelector(`.row[data-row="${btn.dataset.reset}"] .row-label`)?.textContent.trim();
    btn.title = t('usePageDefault');
    btn.setAttribute('aria-label', t('resetSetting', [label ?? '']));
  }
}

function renderAll() {
  dom.headerSub.textContent = host ?? t('popupSubtitle');
  renderControls();
  renderFontList();
  renderPresets();
}

// ─────────────────────────────────────────────
// Notices and access
// ─────────────────────────────────────────────

let flashTimer = 0;

function setAccess(ok, message = '', canGrant = false) {
  canModify = ok;
  clearTimeout(flashTimer);
  dom.notice.hidden = ok;
  dom.noticeText.textContent = message;
  dom.grant.hidden = !canGrant;
  for (const node of dom.lockable) node.inert = !ok;
}

/** Temporary message that does not lock the controls. */
function flash(message) {
  if (!canModify) return;
  dom.notice.hidden = false;
  dom.noticeText.textContent = message;
  dom.grant.hidden = true;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (dom.notice.hidden = true), 5000);
}

async function checkAccess() {
  if (!(await ext.permissions.contains({ origins: HOST_PATTERNS }))) {
    setAccess(false, t('noticeNeedAccess'), true);
    return false;
  }

  // Re-query: the URL is only visible once host access is granted.
  [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab || !FW.siteKey(tab.url)) {
    setAccess(false, t('noticeRestricted'));
    return false;
  }

  try {
    await FW.store.send(tab.id, { type: 'FW_PING' });
    setAccess(true);
    if (applyPending) {
      applyPending = false;
      scheduleApply();
    }
    return true;
  } catch {
    setAccess(false, t('noticeRestricted'));
    return false;
  }
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

async function changeScope(next) {
  if (next === scope) return;
  await save();
  scope = next;
  if (FW.hasOverrides(settings)) {
    try {
      await FW.store.moveTo(next, tab, host, { ...settings });
    } catch {
      flash(t('saveFailed'));
    }
    scheduleApply();
  }
  renderScope();
  FW.announce(scopeHint());
}

async function reset() {
  clearTimeout(saveTimer);
  saveDirty = false;
  try {
    await FW.store.write(scope, tab, host, null);
  } catch {
    flash(t('saveFailed'));
  }
  const active = await loadState();
  renderControls();
  renderFontSelection();
  scheduleApply();
  FW.announce(active ? t(`resetNowUsing_${active}`) : t('resetDone'));
}

async function toggleFocusMode() {
  dom.focus.disabled = true;
  try {
    await applyChain;
    const result = await FW.store.toggleReader(tab.id);
    if (result?.ok && result.open) window.close();
    else if (result?.reason === 'no-article') flash(t('readerNoArticle'));
  } catch {
    flash(t('noticeRestricted'));
  } finally {
    dom.focus.disabled = false;
  }
}

function openSaveForm(open) {
  dom.saveForm.hidden = !open;
  dom.savePreset.setAttribute('aria-expanded', String(open));
  if (open) {
    dom.presetName.value = '';
    dom.presetName.focus();
  } else {
    dom.savePreset.focus();
  }
}

async function submitPreset(event) {
  event.preventDefault();
  const name = dom.presetName.value.trim();
  if (!name) return;
  try {
    const preset = await FW.store.savePreset(name, { ...settings });
    await loadPresets();
    renderPresets();
    dom.saveForm.hidden = true;
    dom.savePreset.setAttribute('aria-expanded', 'false');
    (dom.customPresets.querySelector(`[data-user-preset="${preset?.id}"]`) ?? dom.savePreset).focus();
    FW.announce(t('presetSaved', [name]));
  } catch {
    flash(t('saveFailed'));
  }
}

function selectView(button) {
  for (const btn of dom.viewTabs.querySelectorAll('[data-view]')) {
    const on = btn === button;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    $(`view-${btn.dataset.view}`).hidden = !on;
  }
  dom.viewTabs.dataset.active = button.dataset.view;
}

function selectCategory(button) {
  for (const btn of dom.catTabs.querySelectorAll('[data-cat]')) {
    btn.setAttribute('aria-checked', String(btn === button));
  }
  FW.setTabStop(dom.catTabs, '[data-cat]', button);
  activeCategory = button.dataset.cat;
  renderFontList();
}

let searchTimer = 0;

function onSearch() {
  searchQuery = dom.search.value;
  const count = renderFontList();
  clearTimeout(searchTimer);
  if (searchQuery.trim()) searchTimer = setTimeout(() => FW.announce(t('searchResults', [String(count)])), 600);
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

function bindEvents() {
  dom.toggle.addEventListener('change', () => {
    settings = { ...settings, enabled: dom.toggle.checked };
    renderSummary();
    scheduleApply();
    scheduleSave();
  });

  dom.reset.addEventListener('click', reset);
  dom.focus.addEventListener('click', toggleFocusMode);
  dom.options.addEventListener('click', () => {
    ext.runtime.openOptionsPage().finally(() => window.close());
  });

  // permissions.request must run directly inside the user gesture.
  dom.grant.addEventListener('click', async () => {
    if (!(await ext.permissions.request({ origins: HOST_PATTERNS }))) return;
    if (await checkAccess()) {
      await loadState();
      renderAll();
    }
  });

  dom.scope.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scope]');
    if (btn && !btn.disabled) changeScope(btn.dataset.scope);
  });
  FW.roving(dom.scope, '[data-scope]', { activate: true });

  dom.presets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const preset = FW.buildPreset(FW.PRESETS[btn.dataset.preset], findFont, settings.keepCodeMono);
    replaceSettings({ ...preset, readingRuler: settings.readingRuler }, t('presetApplied', [btn.textContent.trim()]));
  });

  dom.customPresets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-user-preset]');
    const preset = btn && userPresets.find((p) => p.id === btn.dataset.userPreset);
    if (preset) replaceSettings(preset.settings, t('presetApplied', [preset.name]));
  });
  FW.roving(dom.customPresets, '[data-user-preset]');

  dom.savePreset.addEventListener('click', () => openSaveForm(dom.saveForm.hidden));
  dom.cancelPreset.addEventListener('click', () => openSaveForm(false));
  dom.saveForm.addEventListener('submit', submitPreset);
  dom.saveForm.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      openSaveForm(false);
    }
  });

  dom.viewTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (btn) selectView(btn);
  });
  FW.roving(dom.viewTabs, '[data-view]', { activate: true });

  dom.catTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (btn) selectCategory(btn);
  });
  FW.roving(dom.catTabs, '[data-cat]', { activate: true });

  dom.search.addEventListener('input', onSearch);
  dom.search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.search.value) {
      e.preventDefault();
      e.stopPropagation();
      dom.search.value = '';
      onSearch();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const first = dom.fontList.querySelector('.font-btn');
      if (!first) return;
      e.preventDefault();
      FW.setTabStop(dom.fontList, '.font-btn', first);
      first.focus();
    }
  });

  dom.fontList.addEventListener('click', (e) => {
    const btn = e.target.closest('.font-btn');
    if (!btn) return;
    const font = findFont(btn.dataset.fontId);
    const deselect = settings.font?.id === font?.id;
    update({ font: deselect ? null : FW.fontRef(font) });
    FW.setTabStop(dom.fontList, '.font-btn', btn);
  });
  FW.roving(dom.fontList, '.font-btn', { grid: true });

  dom.rescan.addEventListener('click', async () => {
    dom.rescan.disabled = true;
    dom.rescan.setAttribute('aria-busy', 'true');
    try {
      await loadFonts(true);
      renderFontList();
      FW.announce(t('fontCount', [String(availableFonts.length)]));
    } finally {
      dom.rescan.disabled = false;
      dom.rescan.removeAttribute('aria-busy');
    }
  });

  for (const input of dom.ranges) {
    input.addEventListener('input', () => update({ [input.dataset.key]: Number(input.value) }));
  }

  for (const group of dom.segmented) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      const key = group.dataset.key;
      const value = group.dataset.type === 'number' ? Number(btn.dataset.value) : btn.dataset.value;
      update({ [key]: settings[key] === value ? null : value });
      FW.setTabStop(group, 'button', btn);
    });
    FW.roving(group, 'button');
  }

  for (const btn of document.querySelectorAll('[data-reset]')) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.reset;
      update(key === 'theme' ? NO_COLORS : { [key]: null });
      // The reset button hides itself, so move focus to the control it belongs to.
      btn.closest('.row').querySelector('input, [tabindex="0"]')?.focus();
    });
  }

  dom.themes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    const id = btn.dataset.theme;
    update(settings.theme === id ? NO_COLORS : FW.themeColors(id));
    FW.setTabStop(dom.themes, '[data-theme]', btn);
  });
  FW.roving(dom.themes, '[data-theme]');

  for (const palette of dom.palettes) {
    const key = palette.dataset.key;
    const setColor = (value) => {
      const patch = { theme: 'custom', linkColor: null, [key]: value };
      // A background alone could leave the page's text unreadable.
      if (key === 'bgColor' && !settings.textColor) patch.textColor = FW.readableTextOn(value);
      update(patch);
    };
    palette.addEventListener('click', (e) => {
      const btn = e.target.closest('.palette-color');
      if (!btn) return;
      setColor(btn.dataset.color);
      FW.setTabStop(palette, '.palette-color', btn);
    });
    FW.roving(palette, '.palette-color');
    const picker = palette.querySelector('.color-input');
    picker.addEventListener('input', () => setColor(picker.value));
  }

  dom.ruler.addEventListener('change', () => update({ readingRuler: dom.ruler.checked }));
  dom.keepCodeMono.addEventListener('change', () => update({ keepCodeMono: dom.keepCodeMono.checked }));

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input:not([type="range"], [type="checkbox"], [type="color"]), textarea');
    if (e.key === '/' && !typing && !$('view-fonts').hidden && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      dom.search.focus();
      dom.search.select();
    }
  });

  // The popup can close at any moment; flush the pending write.
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
}

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────

async function init() {
  FW.localize();
  injectPreviewFonts();
  buildPalettes();
  bindEvents();

  [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  [prefs, syncOn] = await Promise.all([FW.store.prefs(), FW.store.syncEnabled()]);
  await Promise.all([loadFonts(), loadPresets(), loadState()]);
  renderAll();
  dom.fontList.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  document.body.classList.add('ready');

  await checkAccess();
}

init().catch(() => {
  document.body.classList.add('ready');
  setAccess(false, t('loadFailed'));
});
