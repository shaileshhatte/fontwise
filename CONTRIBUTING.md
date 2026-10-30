# Contributing to Fontwise

Thanks for helping make the web easier to read. This guide covers setup, workflow, checks, manual testing, translations and releases. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- A Chromium browser (121+) and Firefox (140+).
- Node.js 20.19+ for the dev tools (ESLint, [web-ext](https://github.com/mozilla/web-ext), Playwright). The extension itself has no build step and no runtime dependencies.

```sh
git clone https://github.com/shaileshhatte/fontwise.git
cd fontwise
npm install
npx playwright install chromium   # once, for end-to-end tests
```

## Workflow

1. Create a branch from `main`: `feature/<short-name>`, `fix/<short-name>` or `docs/<short-name>`.
2. Edit files in [`extension/`](extension). The same folder is loaded by every browser.
3. Run the extension:
   - `npm run start:firefox` or `npm run start:chrome` opens a temporary browser profile with the extension and reloads it on file changes, **or**
   - load it manually (see [README → Install](README.md#install)) and reload it from `chrome://extensions` or `about:debugging` after each change.
4. Run the [checks](#checks) and the relevant parts of the [manual test checklist](#manual-test-checklist).
5. Open a pull request using the template.

## Checks

```sh
npm run lint       # ESLint + web-ext lint (Mozilla add-on linter)
npm test           # unit tests (node:test, no browser needed)
npm run test:e2e   # end-to-end tests in Chromium with the extension loaded
npm run build      # creates dist/fontwise-<version>.zip
```

CI runs all of these on every push and pull request, and also checks that the vendored files match their npm packages.

Known, harmless warnings:

| Where                 | Warning                                                           | Why                                                                                                             |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `web-ext lint`        | `BACKGROUND_SERVICE_WORKER_IGNORED`                               | Firefox uses `background.scripts`; `service_worker` is there for Chrome.                                        |
| `web-ext lint`        | `UNSAFE_VAR_ASSIGNMENT` ×2 in `vendor/readability/Readability.js` | Unmodified Mozilla Readability; runs on a detached clone. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). |
| `chrome://extensions` | Unrecognized manifest key `browser_specific_settings`             | Firefox-only key; Chrome ignores it.                                                                            |
| `chrome://extensions` | `background.scripts` requires manifest version 2                  | Chrome 121+ ignores it and uses `service_worker`.                                                               |

### Tests

- **Unit tests** (`tests/unit/*.test.js`) load the shared modules into a `node:vm` context. `helpers.js` provides an in-memory fake of the extension APIs. Add a test for every new setting, validation rule or storage behaviour.
- **End-to-end tests** (`tests/e2e/*.spec.js`) start Chromium with the extension, serve a local fixture article and drive the extension through its service worker, popup and options pages. `openPopup()` points the popup at a fixture tab.
- Playwright cannot load Firefox extensions, so Firefox is covered by `web-ext lint` and the manual checklist.

### Vendored assets

Built-in fonts and Mozilla Readability come from npm and are copied into `extension/fonts/`, `extension/vendor/` and `extension/shared/bundled-fonts.js` by:

```sh
npm run vendor
```

Commit the result. Never edit these files by hand. To update them, bump the package in `package.json`, run the command, and update [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) if versions or authors change.

## Debugging

| What           | Chrome                                                       | Firefox                                                                                                     |
| -------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Popup          | Right-click the popup → **Inspect**                          | `about:debugging` → **Inspect**, then pick the popup frame (enable *Disable popup auto-hide* in the ⋯ menu) |
| Options        | Page DevTools                                                | Page DevTools                                                                                               |
| Background     | `chrome://extensions` → **Service worker** link              | `about:debugging` → **Inspect**                                                                             |
| Content script | Page DevTools → Console → context dropdown → *Fontwise*      | Page DevTools → Console                                                                                     |
| Injected CSS   | Page DevTools → Elements → `<style id="__fontwise_style__">` | Same                                                                                                        |

The background console has the whole `Fontwise` namespace loaded:

```js
await chrome.storage.session.get(null);           // tab settings (Firefox: browser.*)
await chrome.storage.local.get(null);             // site settings, font cache, portable data when sync is off
await chrome.storage.sync.get(null);              // portable data when sync is on
await Fontwise.store.effective((await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
await chrome.storage.local.remove('fw_font_cache'); // force font detection again
```

## Manual test checklist

Run in **Chrome and Firefox** before merging user-visible changes.

**Fonts**
- [ ] Clear `fw_font_cache` and open the popup: the grid shows the built-in fonts, the three system defaults and only the catalogue fonts that are installed. The footer count matches.
- [ ] Built-in fonts (Atkinson Hyperlegible, Lexend, Literata, OpenDyslexic) render on a page on a machine where they are not installed.
- [ ] Category filter, search, <kbd>/</kbd>, <kbd>↓</kbd> into the results and <kbd>Esc</kbd> to clear all work.
- [ ] **Rescan** finds a newly installed font.

**Reading controls**
- [ ] Every slider updates the page live and shows its value; the row reset returns it to *Default* and moves focus back to the control.
- [ ] Line length narrows paragraphs; Justify hyphenates on an English page.
- [ ] Themes, palette and picker work. The contrast note appears for custom colours and warns below 4.5:1.
- [ ] The reading ruler follows the mouse and the keyboard focus, never blocks clicks, and disappears when turned off.
- [ ] *Keep code monospace* on: code keeps its font on GitHub or Stack Overflow. Off: it switches.

**Scopes and persistence**
- [ ] *This site* settings appear on another page of the same site in a new tab; *This tab* settings do not.
- [ ] *Everywhere* applies to a new site. Excluding that site in Settings removes it there immediately.
- [ ] Switching scope in the popup moves the settings; **Reset** removes one layer at a time.
- [ ] In a private window, *This site* is disabled with an explanation, and no `fw_site_*` key is written.
- [ ] Changing *Everywhere* or excluded sites updates other open tabs without a reload.
- [ ] Settings → Sync on/off keeps all data. Export, then import into a fresh profile, restores sites and presets. A random JSON file is rejected with a message.
- [ ] Save, apply and delete a custom preset.

**Focus mode, dark mode, shortcuts**
- [ ] Focus mode opens on an article (Wikipedia, a news site) with your font and colours, shows the reading time, and closes with <kbd>Esc</kbd> or Close. Focus returns and the page scrolls again.
- [ ] On a page without an article, the popup (or a toast, for the shortcut) says so.
- [ ] Automatic dark: *Follow system* switches restyled pages when the OS theme changes; a schedule covering the current time darkens them.
- [ ] Each shortcut works, and Settings lists the current bindings.

**Robustness and accessibility**
- [ ] Icon fonts stay intact (fonts.google.com/icons, fontawesome.com, a Bootstrap Icons page).
- [ ] Browser pages (`chrome://`, `about:`), the web stores and PDFs show the notice, and the controls are disabled.
- [ ] A tab opened *before* installing, reloading or updating the extension works after opening the popup.
- [ ] Keyboard only: <kbd>Tab</kbd> reaches each group once; arrow keys move within groups and the font grid; focus is always visible.
- [ ] A screen reader (VoiceOver, NVDA or Orca) announces control names, states, slider values, applied presets and search counts.
- [ ] OS light and dark themes, Windows High Contrast and *reduce motion* all look right in the popup and Settings.
- [ ] Firefox: revoke the site permission (`about:addons` → Fontwise → Permissions); the popup shows **Allow access** and granting it works.
- [ ] Firefox for Android (optional): the popup fills the screen and works with touch.

## Translations

All user-visible text is in [`extension/_locales/en/messages.json`](extension/_locales/en/messages.json). To add a language:

1. Copy the file to `extension/_locales/<code>/messages.json` (for example `de`, `pt_BR`).
2. Translate each `message`. Keep `$1`, `$2` placeholders, and read the `description` notes for context and length limits (`extFullName` ≤ 75 characters, `extDescription` ≤ 132, `badgeOn` ≤ 4).
3. Check the popup at 360 px wide: longer words must not overflow.
4. Mention in the pull request whether you are a native speaker.

Right-to-left languages work automatically through `@@bidi_dir`.

## Coding conventions

- Vanilla JavaScript (ES2022), `'use strict'`, promise-based extension APIs through `const ext = globalThis.browser ?? globalThis.chrome;`.
- Shared code goes in `extension/shared/` as an IIFE attaching to `globalThis.Fontwise`. No top-level `const` in files that may be injected twice.
- Formatting follows [.editorconfig](.editorconfig): 2 spaces (HTML: 4), LF, final newline.
- Comments explain *why* in one short line; do not restate the code.
- Build DOM with `createElement` / `textContent`; never insert dynamic data with `innerHTML`.
- Every value that reaches page CSS goes through `Fontwise.sanitizeSettings()`.
- No network requests, remote code or web fonts. Built-in fonts keep their `Fontwise …` family names.
- **UI:** use the tokens in `shared/tokens.css`. Animate only `opacity`, `translate`, `scale` and colour. Give every new control a label, keyboard support and a forced-colours state.
- All user-visible text goes in `messages.json`.
- Do not add permissions without discussing it in an issue first.
- Where to add fonts, settings, themes and presets: [docs/ARCHITECTURE.md → Extension points](docs/ARCHITECTURE.md#11-extension-points).

## Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat: add word-spacing preset`, `fix(content): keep Codicons intact`, `docs: update architecture diagram`.
- Add user-visible changes to [CHANGELOG.md](CHANGELOG.md) under *Unreleased*.

## Icons and store artwork

- `extension/icons/` holds the PNGs referenced by the manifest (16, 32, 48, 128 px).
- `assets/icons/icon.svg` (detailed, ≥ 48 px) and `assets/icons/icon-small.svg` (simplified, 16 and 32 px) are the sources; larger renders sit next to them.
- `assets/store/` holds store artwork such as the 440 × 280 promo tile.
- The SVGs use system fonts (Georgia, Avenir Next). Render them on a machine with those fonts, for example with [`@resvg/resvg-js`](https://github.com/thx/resvg-js), and keep the 16/32 px icons rendered from `icon-small.svg`.

## Releasing

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for the full store submission guide. In short:

1. Bump `version` in `extension/manifest.json` (semantic versioning).
2. Move the *Unreleased* entries in `CHANGELOG.md` under the new version and date.
3. Run `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` and the manual test checklist.
4. Commit, then tag and push: `git tag v<version> && git push origin v<version>`. The *Release* workflow checks that the tag matches the manifest, builds `fontwise-<version>.zip` and attaches it to a GitHub release.
5. Upload that zip to the Chrome Web Store, Microsoft Edge Add-ons and addons.mozilla.org.
