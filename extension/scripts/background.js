/*
  background.js — Fontwise

  Serves effective settings to content scripts on page load, keeps the
  toolbar badge in sync, re-applies settings to open tabs when shared layers
  (site, Everywhere, excluded sites, preferences) change, and handles the
  keyboard shortcuts. Runs as a service worker in Chrome (shared files loaded
  with importScripts) and as an event page in Firefox (shared files listed in
  background.scripts).
*/

'use strict';

if (typeof importScripts === 'function') {
  importScripts('/shared/settings.js', '/shared/catalog.js', '/shared/store.js');
}

const ext = globalThis.browser ?? globalThis.chrome;
const FW = globalThis.Fontwise;
const WEB = ['http://*/*', 'https://*/*'];

// ---- Page load -------------------------------------------------------------

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'FW_GET' || !sender.tab) return false;

  Promise.all([FW.store.effective(sender.tab), FW.store.prefs()])
    .then(([{ settings }, prefs]) => {
      sendResponse({ settings, autoDark: prefs.autoDark });
      FW.store.badge(sender.tab.id, settings);
    })
    .catch(() => sendResponse(null));
  return true;
});

// Pages without a content script (browser pages, stores, PDF viewers) must not keep a stale badge.
ext.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url && !FW.siteKey(info.url)) FW.store.badge(tabId, null);
});

ext.tabs.onRemoved.addListener((tabId) => {
  ext.storage.session.remove(FW.KEY.tab(tabId));
});

// Chrome swaps in prerendered tabs under a new id.
ext.tabs.onReplaced?.addListener(async (addedTabId, removedTabId) => {
  const key = FW.KEY.tab(removedTabId);
  const { [key]: settings } = await ext.storage.session.get(key);
  if (settings) await ext.storage.session.set({ [FW.KEY.tab(addedTabId)]: settings });
  await ext.storage.session.remove(key);
});

// ---- Live updates ------------------------------------------------------------

const AFFECTS_PAGES = (key) =>
  key === FW.KEY.global || key === FW.KEY.prefs || key === FW.KEY.excluded || key === FW.KEY.sync ||
  key.startsWith(FW.KEY.sitePrefix);

let broadcastTimer = 0;

ext.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' || !Object.keys(changes).some(AFFECTS_PAGES)) return;
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(broadcast, 150);
});

/** Re-applies settings to every open web tab; tabs that predate the install get the content script injected. */
async function broadcast({ injectAll = false } = {}) {
  const [tabs, snapshot] = await Promise.all([ext.tabs.query({ url: WEB }), FW.store.snapshot()]);
  await Promise.allSettled(
    tabs
      .filter((tab) => !tab.discarded)
      .map(async (tab) => {
        const settings = snapshot.effective(tab);
        const message = { type: 'FW_APPLY', settings, autoDark: snapshot.prefs.autoDark };
        await (settings || injectAll ? FW.store.send(tab.id, message) : ext.tabs.sendMessage(tab.id, message));
        await FW.store.badge(tab.id, settings);
      }),
  );
}

ext.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    ext.tabs.create({ url: ext.runtime.getURL('welcome/welcome.html') });
  } else if (reason === 'update') {
    // Content scripts from the previous version are orphaned; restyle the open tabs.
    broadcast().catch(() => {});
  }
});

// ---- Keyboard shortcuts ------------------------------------------------------

async function bestPreset() {
  const fonts = FW.availableFonts(await FW.store.installedFontIds());
  return FW.buildPreset(FW.PRESETS.best, (id) => fonts.find((font) => font.id === id) ?? null);
}

const COMMANDS = {
  /** Same as the popup switch: flips the layer that currently applies, or starts with the best preset. */
  async 'toggle-fontwise'(tab) {
    const { settings, scope, host } = await FW.store.effective(tab);
    if (settings) {
      await FW.store.write(FW.store.editableScope(scope, tab, host), tab, host, { ...settings, enabled: !settings.enabled });
    } else {
      const prefs = await FW.store.prefs();
      await FW.store.moveTo(FW.store.defaultScope(prefs, tab, host), tab, host, await bestPreset());
    }
    await FW.store.applyTo(tab);
  },

  async 'apply-best'(tab) {
    const [{ scope, host }, prefs] = await Promise.all([FW.store.effective(tab), FW.store.prefs()]);
    const target = scope ? FW.store.editableScope(scope, tab, host) : FW.store.defaultScope(prefs, tab, host);
    await FW.store.moveTo(target, tab, host, await bestPreset());
    await FW.store.applyTo(tab);
  },

  async 'toggle-focus-mode'(tab) {
    await FW.store.toggleReader(tab.id, { notify: true });
  },
};

ext.commands?.onCommand.addListener(async (command, commandTab) => {
  const tab = commandTab ?? (await ext.tabs.query({ active: true, currentWindow: true }))[0];
  if (!COMMANDS[command] || !tab?.id || !FW.siteKey(tab.url)) return;
  try {
    await COMMANDS[command](tab);
  } catch {
    // Restricted page (browser UI, web store, PDF viewer): nothing to restyle.
  }
});
