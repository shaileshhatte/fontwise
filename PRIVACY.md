# Privacy Policy — Fontwise

_Last updated: 2026-10-30_

Fontwise is a browser extension that changes how web pages look so they are easier to read. It does **not** collect, transmit, sell or share any personal or usage data, and it makes no network requests.

## What Fontwise stores

Everything is kept in your browser's extension storage:

| Data                                                                                | Where                                                  | When it is deleted                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Reading settings for a tab (*This tab*)                                             | `storage.session`, on this device                      | When the tab closes or the browser quits                                            |
| Reading settings for a site (*This site*), keyed by host name such as `example.com` | `storage.local`, on this device                        | When you forget the site (popup **Reset** or **Settings**), or remove the extension |
| *Everywhere* settings, preferences, excluded sites and your presets                 | `storage.local`, or `storage.sync` if you turn on sync | When you clear them in **Settings**, or remove the extension                        |
| List of detected installed fonts (catalogue ids such as `georgia`)                  | `storage.local`, on this device                        | When the extension is removed, or replaced on **Rescan**                            |

**Private windows:** site settings are never saved from a private (incognito) window, so no host names from private browsing are written to disk.

**Sync (off by default):** if you turn on *Sync across devices*, your preferences, *Everywhere* settings, excluded sites and presets are stored with your browser's own sync service (your Google, Microsoft or Mozilla account), under that provider's privacy policy. Per-site settings, which contain host names you visited, are **never** synced.

**Backups:** *Export settings* saves a JSON file to a location you choose. It contains the data above, including the host names of remembered sites. Fontwise never uploads it.

## What Fontwise does not do

- No analytics, telemetry, crash reporting or advertising.
- No network requests of any kind. The built-in fonts and the Focus mode library ship inside the extension.
- It does not record or transmit the content, addresses or history of the pages you visit. It reads a page's host name only to look up and save that site's settings.
- **Focus mode** reads the current page's text only when you open it, entirely inside your browser, to show the article. Nothing is stored or sent.

## Permissions

| Permission                               | Purpose                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `storage`                                | Keep the data listed above.                                                                |
| `scripting`                              | Add Fontwise to tabs that were open before installation, and load Focus mode when you ask. |
| Access to `http://*/*` and `https://*/*` | Apply your reading styles to the pages you view.                                           |

Built-in fonts are declared as *web-accessible resources* so pages can display them. A website could, in principle, test whether these font files exist and so detect that Fontwise is installed. The files contain only public, open-licensed fonts.

## Font detection

To list installed fonts, Fontwise measures text drawn on a hidden canvas inside its own popup. The result is used only to build the font list and never leaves your device or reaches web pages.

## Changes

Changes to this policy are recorded in this file's history and in [CHANGELOG.md](CHANGELOG.md).

## Contact

For questions, open an issue at <https://github.com/shaileshhatte/fontwise/issues>. For security concerns, see [SECURITY.md](SECURITY.md).
