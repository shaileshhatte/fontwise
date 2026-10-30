/*
  options.js — Fontwise settings page: preferences, sync, automatic dark,
  sites, presets, shortcuts and backup.
*/

'use strict';

const ext = globalThis.browser ?? globalThis.chrome;
const FW = globalThis.Fontwise;
const { t } = FW;

const MAX_IMPORT_BYTES = 1024 * 1024;
const $ = (id) => document.getElementById(id);

const dom = {
  scopeRadios: [...document.querySelectorAll('input[name="defaultScope"]')],
  darkRadios: [...document.querySelectorAll('input[name="autoDark"]')],
  sync: $('sync'),
  schedule: $('schedule'),
  darkStart: $('dark-start'),
  darkEnd: $('dark-end'),
  globalSummary: $('global-summary'),
  clearGlobal: $('btn-clear-global'),
  siteList: $('site-list'),
  forgetAll: $('btn-forget-all'),
  excludeForm: $('exclude-form'),
  excludeInput: $('exclude-input'),
  excludeError: $('exclude-error'),
  excludedList: $('excluded-list'),
  presetList: $('preset-list'),
  shortcutList: $('shortcut-list'),
  shortcuts: $('btn-shortcuts'),
  exportBtn: $('btn-export'),
  importBtn: $('btn-import'),
  importFile: $('import-file'),
  version: $('about-version'),
  toast: $('toast'),
};

let prefs = FW.sanitizePrefs(null);

// ─────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────

let toastTimer = 0;

function toast(text, kind = 'info') {
  clearTimeout(toastTimer);
  dom.toast.dataset.kind = kind;
  dom.toast.textContent = text;
  dom.toast.classList.add('show');
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 4000);
}

/** Runs a storage action; reports failure (e.g. sync quota) instead of failing silently. */
async function attempt(action, success) {
  try {
    const result = await action();
    if (success) toast(success);
    return result;
  } catch (error) {
    toast(t('optError', [error?.message ?? String(error)]), 'error');
    return undefined;
  }
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────

function listItem({ title, meta, actionLabel, actionName, onAction }) {
  const li = document.createElement('li');
  li.className = 'list-item';
  const main = document.createElement('div');
  main.className = 'list-main';
  const titleEl = document.createElement('span');
  titleEl.className = 'list-title';
  titleEl.textContent = title;
  titleEl.title = title;
  main.append(titleEl);
  if (meta) {
    const metaEl = document.createElement('span');
    metaEl.className = 'list-meta';
    metaEl.textContent = meta;
    metaEl.title = meta;
    main.append(metaEl);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-small btn-danger';
  btn.textContent = actionLabel;
  btn.setAttribute('aria-label', actionName);
  btn.addEventListener('click', () => removeItem(li, onAction));
  li.append(main, btn);
  return li;
}

/** Removes a list entry and keeps keyboard focus on a sensible neighbour. */
async function removeItem(li, action) {
  const list = li.parentElement;
  const index = [...list.children].indexOf(li);
  await attempt(action);
  await refresh();
  const next = list.children[Math.min(index, list.children.length - 1)]?.querySelector('button');
  (next ?? list.closest('section').querySelector('h2, h1')).focus?.();
}

function emptyItem(text) {
  const li = document.createElement('li');
  li.className = 'list-empty';
  li.textContent = text;
  return li;
}

function renderPrefs(syncOn) {
  for (const radio of dom.scopeRadios) radio.checked = radio.value === prefs.defaultScope;
  for (const radio of dom.darkRadios) radio.checked = radio.value === prefs.autoDark.mode;
  dom.schedule.hidden = prefs.autoDark.mode !== 'schedule';
  dom.darkStart.value = prefs.autoDark.start;
  dom.darkEnd.value = prefs.autoDark.end;
  dom.sync.checked = syncOn;
}

function renderGlobal(global) {
  dom.globalSummary.textContent = global ? FW.describeSettings(global) : t('optNotSet');
  dom.clearGlobal.disabled = !global;
}

function renderSites(sites) {
  dom.siteList.replaceChildren(
    ...(sites.length
      ? sites.map(({ host, settings }) =>
          listItem({
            title: host,
            meta: FW.describeSettings(settings),
            actionLabel: t('optForget'),
            actionName: t('optForgetSite', [host]),
            onAction: () => FW.store.forgetSite(host),
          }),
        )
      : [emptyItem(t('optNoSites'))]),
  );
  dom.forgetAll.disabled = sites.length === 0;
}

function renderExcluded(list) {
  dom.excludedList.replaceChildren(
    ...(list.length
      ? list.map((host) =>
          listItem({
            title: host,
            actionLabel: t('optRemove'),
            actionName: t('optRemoveSite', [host]),
            onAction: async () => FW.store.setExcluded((await FW.store.excluded()).filter((h) => h !== host)),
          }),
        )
      : [emptyItem(t('optNoExcluded'))]),
  );
}

function renderPresets(presets) {
  dom.presetList.replaceChildren(
    ...(presets.length
      ? presets.map((preset) =>
          listItem({
            title: preset.name,
            meta: FW.describeSettings(preset.settings),
            actionLabel: t('optDelete'),
            actionName: t('optDeletePreset', [preset.name]),
            onAction: () => FW.store.deletePreset(preset.id),
          }),
        )
      : [emptyItem(t('optNoPresets'))]),
  );
}

async function renderShortcuts() {
  const commands = (await ext.commands?.getAll?.()) ?? [];
  dom.shortcutList.replaceChildren(
    ...commands.map((command) => {
      const row = document.createElement('div');
      row.className = 'shortcut';
      const dt = document.createElement('dt');
      dt.textContent = FW.commandLabel(command);
      const dd = document.createElement('dd');
      if (command.shortcut) {
        const keys = command.shortcut.split('+');
        keys.forEach((key, i) => {
          const kbd = document.createElement('kbd');
          kbd.textContent = key;
          dd.append(kbd);
          if (i < keys.length - 1) dd.append(' + ');
        });
      } else {
        dd.className = 'muted';
        dd.textContent = t('optShortcutNotSet');
      }
      row.append(dt, dd);
      return row;
    }),
  );
}

async function refresh() {
  const [nextPrefs, syncOn, global, sites, excluded, presets] = await Promise.all([
    FW.store.prefs(),
    FW.store.syncEnabled(),
    FW.store.globalSettings(),
    FW.store.sites(),
    FW.store.excluded(),
    FW.store.presets(),
  ]);
  prefs = nextPrefs;
  // Never overwrite a field the user is editing.
  if (!document.activeElement?.matches?.('.time-input')) renderPrefs(syncOn);
  renderGlobal(global);
  renderSites(sites);
  renderExcluded(excluded);
  renderPresets(presets);
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

/** Accepts "example.com", "www.example.com" or a full URL. */
function normaliseHost(input) {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  const host = FW.siteKey(text.includes('://') ? text : `https://${text}`);
  return host && FW.isHostname(host) && (host.includes('.') || host === 'localhost') ? host : null;
}

function setExcludeError(message) {
  dom.excludeError.hidden = !message;
  dom.excludeError.textContent = message ?? '';
  dom.excludeInput.setAttribute('aria-invalid', String(!!message));
}

async function addExcluded(event) {
  event.preventDefault();
  const host = normaliseHost(dom.excludeInput.value);
  if (!host) {
    setExcludeError(t('optInvalidSite'));
    dom.excludeInput.focus();
    return;
  }
  const list = await FW.store.excluded();
  if (list.includes(host)) {
    setExcludeError(t('optAlreadyExcluded', [host]));
    return;
  }
  setExcludeError(null);
  await attempt(() => FW.store.setExcluded([...list, host]), t('optExcludedAdded', [host]));
  dom.excludeInput.value = '';
  await refresh();
}

function exportData() {
  attempt(async () => {
    const data = await FW.store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fontwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, t('optExported'));
}

async function importData() {
  const file = dom.importFile.files?.[0];
  dom.importFile.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    toast(t('optImportTooLarge'), 'error');
    return;
  }
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast(t('optImportInvalid'), 'error');
    return;
  }
  const result = await attempt(() => FW.store.importData(data));
  if (!result) return;
  toast(t('optImported', [String(result.sites), String(result.presets)]));
  await refresh();
}

async function setSync() {
  const enabled = dom.sync.checked;
  dom.sync.disabled = true;
  const ok = await attempt(async () => {
    await FW.store.setSync(enabled);
    return true;
  }, t(enabled ? 'optSyncOn' : 'optSyncOff'));
  // Roll back the switch if the move failed (for example, the sync quota is full).
  if (!ok) dom.sync.checked = !enabled;
  dom.sync.disabled = false;
  await refresh();
}

async function setTimes() {
  const start = dom.darkStart.value;
  const end = dom.darkEnd.value;
  if (!start || !end) return;
  prefs = await attempt(() => FW.store.setPrefs({ autoDark: { ...prefs.autoDark, start, end } }), t('optSaved')) ?? prefs;
}

function openShortcutSettings() {
  // Firefox 137+; Chromium browsers redirect chrome:// to their own scheme.
  if (ext.commands?.openShortcutSettings) ext.commands.openShortcutSettings();
  else ext.tabs.create({ url: 'chrome://extensions/shortcuts' });
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

function bindEvents() {
  for (const radio of dom.scopeRadios) {
    radio.addEventListener('change', async () => {
      prefs = await attempt(() => FW.store.setPrefs({ defaultScope: radio.value }), t('optSaved')) ?? prefs;
    });
  }
  for (const radio of dom.darkRadios) {
    radio.addEventListener('change', async () => {
      dom.schedule.hidden = radio.value !== 'schedule';
      prefs = await attempt(() => FW.store.setPrefs({ autoDark: { ...prefs.autoDark, mode: radio.value } }), t('optSaved')) ?? prefs;
    });
  }
  dom.darkStart.addEventListener('change', setTimes);
  dom.darkEnd.addEventListener('change', setTimes);
  dom.sync.addEventListener('change', setSync);

  dom.clearGlobal.addEventListener('click', async () => {
    if (!confirm(t('optConfirmClearGlobal'))) return;
    await attempt(() => FW.store.clearGlobal(), t('optCleared'));
    await refresh();
  });

  dom.forgetAll.addEventListener('click', async () => {
    if (!confirm(t('optConfirmForgetAll'))) return;
    await attempt(() => FW.store.forgetAllSites(), t('optCleared'));
    await refresh();
  });

  dom.excludeForm.addEventListener('submit', addExcluded);
  dom.excludeInput.addEventListener('input', () => setExcludeError(null));
  dom.shortcuts.addEventListener('click', openShortcutSettings);
  dom.exportBtn.addEventListener('click', exportData);
  dom.importBtn.addEventListener('click', () => dom.importFile.click());
  dom.importFile.addEventListener('change', importData);

  // Reflect changes made in the popup or synced from another device.
  let refreshTimer = 0;
  ext.storage.onChanged.addListener((_changes, area) => {
    if (area === 'session') return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 200);
  });
  // Shortcut changes have no event; re-read them when the user comes back to this tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderShortcuts();
  });
}

async function init() {
  FW.localize();
  dom.version.textContent = t('optVersion', [ext.runtime.getManifest().version]);
  bindEvents();
  await Promise.all([refresh(), renderShortcuts()]);
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

init();
