// Loads Fontwise's classic browser scripts into an isolated Node context.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const ROOT = new URL('../../extension/', import.meta.url);

export const readJson = (path) => JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));

/** Runs the given extension files in one context and returns its `Fontwise` namespace. */
export function load(files, globals = {}) {
  const context = vm.createContext({ URL, console, setTimeout, clearTimeout, ...globals });
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(file, ROOT), 'utf8'), context, { filename: file });
  }
  return context.Fontwise;
}

// Objects created inside the vm context have foreign prototypes; compare plain copies.
export const plain = (value) => JSON.parse(JSON.stringify(value));

function fakeArea() {
  const data = {};
  return {
    data,
    async get(keys) {
      if (keys == null) return structuredClone(data);
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, structuredClone(data[key])]));
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
    },
    async remove(keys) {
      for (const key of [].concat(keys)) delete data[key];
    },
  };
}

/** Minimal in-memory stand-in for the extension APIs used by store.js. */
export function fakeExtension() {
  const sent = [];
  return {
    sent,
    storage: {
      local: fakeArea(),
      sync: fakeArea(),
      session: fakeArea(),
      onChanged: { addListener() {} },
    },
    i18n: { getMessage: (key) => (key === 'badgeOn' ? 'On' : key) },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
    tabs: {
      async sendMessage(tabId, message) {
        sent.push({ tabId, message });
        return true;
      },
    },
    scripting: { async executeScript() {} },
  };
}

export const SHARED = ['shared/bundled-fonts.js', 'shared/settings.js', 'shared/catalog.js', 'shared/css.js'];
