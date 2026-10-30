/*
  store.js — Fontwise storage layers and tab messaging, shared by the popup,
  options page and background script. Requires the extension APIs.

  Layers (narrowest wins):
    tab     storage.session  fw_tab_{tabId}   cleared when the tab closes
    site    storage.local    fw_site_{host}   never written from private windows
    global  "portable" area  fw_global        "Everywhere"; skipped on excluded sites
  The portable area is storage.sync when the user enables sync, otherwise
  storage.local. Per-site data always stays on the device.
*/

'use strict';

(() => {
  const FW = (globalThis.Fontwise ??= {});
  const ext = globalThis.browser ?? globalThis.chrome;

  const KEY = Object.freeze({
    tab: (tabId) => `fw_tab_${tabId}`,
    site: (host) => `fw_site_${host}`,
    preset: (id) => `fw_preset_${id}`,
    sitePrefix: 'fw_site_',
    presetPrefix: 'fw_preset_',
    global: 'fw_global',
    prefs: 'fw_prefs',
    excluded: 'fw_excluded',
    sync: 'fw_sync',
    fontCache: 'fw_font_cache',
  });
  FW.KEY = KEY;

  // Must match content_scripts.js in manifest.json.
  FW.CONTENT_SCRIPTS = Object.freeze([
    '/shared/bundled-fonts.js',
    '/shared/settings.js',
    '/shared/css.js',
    '/scripts/content.js',
  ]);
  const READABILITY = '/vendor/readability/Readability.js';

  FW.isPortableKey = (key) =>
    key === KEY.global || key === KEY.prefs || key === KEY.excluded || key.startsWith(KEY.presetPrefix);

  const read = async (area, key) => (await area.get(key))[key];

  const put = (area, key, value) => (value == null ? area.remove(key) : area.set({ [key]: value }));

  // Cached so a save started while a page unloads does not wait on a storage read first.
  let portableArea = null;

  async function portable() {
    portableArea ??= (await read(ext.storage.local, KEY.sync)) ? ext.storage.sync : ext.storage.local;
    return portableArea;
  }

  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && KEY.sync in changes) portableArea = null;
  });

  async function target(scope, tab, host) {
    if (scope === 'tab') return tab?.id != null ? [ext.storage.session, KEY.tab(tab.id)] : null;
    // Writing a hostname from a private window would leak browsing history to disk.
    if (scope === 'site') return host && !tab?.incognito ? [ext.storage.local, KEY.site(host)] : null;
    if (scope === 'global') return [await portable(), KEY.global];
    return null;
  }

  /** Layers for `tab` from raw storage contents { session, local, portable }. */
  function layersFrom(data, tab) {
    const host = FW.siteKey(tab?.url);
    const excluded = data.portable[KEY.excluded];
    return {
      host,
      tab: tab?.id != null ? FW.sanitizeSettings(data.session[KEY.tab(tab.id)]) : null,
      site: host ? FW.sanitizeSettings(data.local[KEY.site(host)]) : null,
      global: FW.sanitizeSettings(data.portable[KEY.global]),
      excluded: !!host && Array.isArray(excluded) && excluded.includes(host),
    };
  }

  FW.store = {
    async syncEnabled() {
      return !!(await read(ext.storage.local, KEY.sync));
    },

    async prefs() {
      return FW.sanitizePrefs(await read(await portable(), KEY.prefs));
    },

    async setPrefs(patch) {
      const next = FW.sanitizePrefs({ ...(await FW.store.prefs()), ...patch });
      await put(await portable(), KEY.prefs, next);
      return next;
    },

    /** Scope for new changes on `tab`: the user's preference, unless site storage is impossible there. */
    defaultScope(prefs, tab, host) {
      return FW.store.editableScope(prefs.defaultScope, tab, host);
    },

    /** Site layers cannot be written from private windows or host-less pages; edit a tab override instead. */
    editableScope(scope, tab, host) {
      return scope === 'site' && (!host || tab?.incognito) ? 'tab' : scope;
    },

    async layers(tab) {
      const host = FW.siteKey(tab?.url);
      const [session, local, portableData] = await Promise.all([
        tab?.id != null ? ext.storage.session.get(KEY.tab(tab.id)) : {},
        host ? ext.storage.local.get(KEY.site(host)) : {},
        portable().then((area) => area.get([KEY.global, KEY.excluded])),
      ]);
      return layersFrom({ session, local, portable: portableData }, tab);
    },

    /** Effective settings for `tab`: { settings, scope, host }. */
    async effective(tab) {
      const layers = await FW.store.layers(tab);
      return { ...FW.resolve(layers), host: layers.host };
    },

    /** Reads everything once; for resolving many tabs at a time. */
    async snapshot() {
      const syncOn = await FW.store.syncEnabled();
      const [session, local, sync] = await Promise.all([
        ext.storage.session.get(null),
        ext.storage.local.get(null),
        syncOn ? ext.storage.sync.get(null) : null,
      ]);
      const data = { session, local, portable: sync ?? local };
      return {
        prefs: FW.sanitizePrefs(data.portable[KEY.prefs]),
        effective: (tab) => FW.resolve(layersFrom(data, tab)).settings,
      };
    },

    /** Saves `settings` in one layer; settings without overrides remove that layer. */
    async write(scope, tab, host, settings) {
      const where = await target(scope, tab, host);
      if (!where) return false;
      await put(where[0], where[1], settings && FW.hasOverrides(settings) ? settings : null);
      return true;
    },

    /** Saves in `scope` and removes narrower layers for this page, which would otherwise shadow it. */
    async moveTo(scope, tab, host, settings) {
      const saved = await FW.store.write(scope, tab, host, settings);
      const rank = FW.SCOPES.indexOf(scope);
      if (saved && rank > 0) await FW.store.write('tab', tab, host, null);
      if (saved && rank > 1 && host) await FW.store.write('site', tab, host, null);
      return saved;
    },

    async sites() {
      const all = await ext.storage.local.get(null);
      return Object.entries(all)
        .filter(([key]) => key.startsWith(KEY.sitePrefix))
        .map(([key, value]) => ({ host: key.slice(KEY.sitePrefix.length), settings: FW.sanitizeSettings(value) }))
        .filter((site) => site.settings)
        .sort((a, b) => a.host.localeCompare(b.host));
    },

    forgetSite(host) {
      return ext.storage.local.remove(KEY.site(host));
    },

    async forgetAllSites() {
      const sites = await FW.store.sites();
      await ext.storage.local.remove(sites.map((site) => KEY.site(site.host)));
    },

    async globalSettings() {
      return FW.sanitizeSettings(await read(await portable(), KEY.global));
    },

    async clearGlobal() {
      await (await portable()).remove(KEY.global);
    },

    async excluded() {
      const list = await read(await portable(), KEY.excluded);
      return Array.isArray(list) ? list.filter(FW.isHostname) : [];
    },

    async setExcluded(list) {
      const clean = [...new Set(list.filter(FW.isHostname).map((host) => host.toLowerCase()))].sort();
      await put(await portable(), KEY.excluded, clean);
    },

    async presets() {
      const all = await (await portable()).get(null);
      return Object.entries(all)
        .filter(([key]) => key.startsWith(KEY.presetPrefix))
        .map(([, value]) => FW.sanitizePreset(value))
        .filter(Boolean)
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async savePreset(name, settings) {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const preset = FW.sanitizePreset({ id, name, settings, createdAt: Date.now() });
      if (preset) await (await portable()).set({ [KEY.preset(id)]: preset });
      return preset;
    },

    async deletePreset(id) {
      await (await portable()).remove(KEY.preset(id));
    },

    /** Moves the portable data between storage.local and storage.sync. Keeps data already at the destination. */
    async setSync(enabled) {
      const from = enabled ? ext.storage.local : ext.storage.sync;
      const to = enabled ? ext.storage.sync : ext.storage.local;
      const source = Object.fromEntries(Object.entries(await from.get(null)).filter(([key]) => FW.isPortableKey(key)));
      const existing = await to.get(null);
      const missing = Object.fromEntries(Object.entries(source).filter(([key]) => !(key in existing)));
      if (Object.keys(missing).length) await to.set(missing);
      if (enabled) await ext.storage.local.remove(Object.keys(source));
      await ext.storage.local.set({ [KEY.sync]: enabled });
      portableArea = to;
    },

    async exportData() {
      const [prefs, global, excluded, presets, sites] = await Promise.all([
        FW.store.prefs(),
        FW.store.globalSettings(),
        FW.store.excluded(),
        FW.store.presets(),
        FW.store.sites(),
      ]);
      return {
        app: 'fontwise',
        format: 1,
        exportedAt: new Date().toISOString(),
        prefs,
        global,
        excluded,
        presets,
        sites: Object.fromEntries(sites.map((site) => [site.host, site.settings])),
      };
    },

    /** Imports a backup made by exportData(); every value is re-validated. Returns counts. */
    async importData(data) {
      if (!data || data.app !== 'fontwise' || data.format !== 1) throw new Error('Unsupported backup file');

      const portableWrites = {};
      if (data.prefs) portableWrites[KEY.prefs] = FW.sanitizePrefs(data.prefs);
      const global = FW.sanitizeSettings(data.global);
      if (global && FW.hasOverrides(global)) portableWrites[KEY.global] = global;
      if (Array.isArray(data.excluded)) {
        portableWrites[KEY.excluded] = [...new Set(data.excluded.filter(FW.isHostname).map((h) => h.toLowerCase()))];
      }
      const presets = (Array.isArray(data.presets) ? data.presets : []).map(FW.sanitizePreset).filter(Boolean);
      for (const preset of presets) portableWrites[KEY.preset(preset.id)] = preset;
      await (await portable()).set(portableWrites);

      const siteWrites = {};
      const sites = data.sites && typeof data.sites === 'object' ? data.sites : {};
      for (const [host, value] of Object.entries(sites)) {
        const settings = FW.sanitizeSettings(value);
        if (FW.isHostname(host) && settings && FW.hasOverrides(settings)) siteWrites[KEY.site(host.toLowerCase())] = settings;
      }
      await ext.storage.local.set(siteWrites);

      return { presets: presets.length, sites: Object.keys(siteWrites).length, global: KEY.global in portableWrites };
    },

    /** Cached installed-font ids; runs `detect()` when the cache is missing or outdated and a detector is given. */
    async installedFontIds({ force = false, detect = null } = {}) {
      let cache = force ? null : await read(ext.storage.local, KEY.fontCache);
      const valid = (c) => c?.catalogVersion === FW.CATALOG_VERSION && Array.isArray(c.installedIds);
      if (!valid(cache) && detect) {
        cache = { catalogVersion: FW.CATALOG_VERSION, installedIds: detect(), scannedAt: Date.now() };
        await ext.storage.local.set({ [KEY.fontCache]: cache });
      }
      return valid(cache) ? cache.installedIds : [];
    },

    /** Sends a message to the tab's content script, injecting it first if the tab predates install/update. */
    async send(tabId, message) {
      try {
        return await ext.tabs.sendMessage(tabId, message);
      } catch {
        await ext.scripting.executeScript({ target: { tabId }, files: [...FW.CONTENT_SCRIPTS] });
        return ext.tabs.sendMessage(tabId, message);
      }
    },

    /** Re-applies the effective settings to `tab` and updates its badge. */
    async applyTo(tab, { inject = true } = {}) {
      const [{ settings }, prefs] = await Promise.all([FW.store.effective(tab), FW.store.prefs()]);
      const message = { type: 'FW_APPLY', settings, autoDark: prefs.autoDark };
      await (inject ? FW.store.send(tab.id, message) : ext.tabs.sendMessage(tab.id, message));
      await FW.store.badge(tab.id, settings);
      return settings;
    },

    /** Opens or closes Focus mode; resolves to { ok, open } or { ok: false, reason }. `notify` shows failures on the page. */
    async toggleReader(tabId, { notify = false } = {}) {
      await FW.store.send(tabId, { type: 'FW_PING' });
      await ext.scripting.executeScript({ target: { tabId }, files: [READABILITY] });
      return ext.tabs.sendMessage(tabId, { type: 'FW_READER', notify });
    },

    async badge(tabId, settings) {
      const on = !!settings && settings.enabled !== false && FW.hasOverrides(settings);
      try {
        await ext.action.setBadgeText({ tabId, text: on ? ext.i18n.getMessage('badgeOn') : '' });
        if (on) await ext.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' });
      } catch {
        // The tab closed before the badge could be updated.
      }
    },
  };
})();
