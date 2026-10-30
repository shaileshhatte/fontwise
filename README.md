<p align="center">
  <img src="assets/icons/icon-256.png" alt="" width="128" height="128">
</p>

<h1 align="center">Fontwise</h1>

<p align="center">
  <strong>Readable fonts and reading comfort for any web page.</strong><br>
  A privacy-friendly browser extension for Chrome, Edge, Firefox and other modern browsers.
</p>

<p align="center">
  <a href="https://github.com/shaileshhatte/fontwise/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/shaileshhatte/fontwise/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-6366f1.svg">
  <img alt="No tracking" src="https://img.shields.io/badge/data%20collected-none-34d399.svg">
</p>

Fontwise makes any article easier to read. Pick a highly readable font (installed on your computer or built into Fontwise), tune size, spacing, colours and line length, or press **Best for reading** for a research-based setup. Keep the change to one tab, remember it for a site, or use it everywhere. **Focus mode** shows just the article, and the **reading ruler** keeps your place.

---

## Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Permissions and privacy](#permissions-and-privacy)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [Development](#development)
- [How it works](#how-it-works)
- [Known limitations](#known-limitations)
- [Contributing and translations](#contributing-and-translations)
- [Credits](#credits)
- [License](#license)

---

## Features

**Fonts**
- **Four built-in reading fonts** that work everywhere, with nothing to install: Atkinson Hyperlegible, Lexend, OpenDyslexic and Literata.
- Detection of **84 more hand-picked, highly readable typefaces** already installed on your computer: 61 Latin fonts plus 23 for Chinese, Japanese, Korean, Arabic, Devanagari and Hebrew. System Sans, System Serif and System Mono are always available.
- Grouped as **Sans-serif**, **Serif** and **Mono**, with search (press <kbd>/</kbd>), a live "Aa" preview and badges for built-in, dyslexia-friendly and non-Latin fonts. **Rescan** picks up fonts you install later.

**Reading controls**

| Group   | Control                  | Range / options                                           |
| ------- | ------------------------ | --------------------------------------------------------- |
| Text    | Font size                | 12–28 px                                                  |
|         | Line spacing             | 1.00–2.50                                                 |
|         | Letter spacing           | 0–0.15 em                                                 |
|         | Word spacing             | 0–0.40 em                                                 |
|         | Paragraph spacing        | 0–3.0 em                                                  |
|         | Weight                   | Light, Regular, Medium, Semibold, Bold                    |
|         | Style                    | Normal, Italic                                            |
| Colours | Theme                    | Light, Sepia, Dark, High contrast                         |
|         | Text / background colour | Curated palette or any colour, with a WCAG contrast check |
| Layout  | Line length              | 45–100 characters                                         |
|         | Margin width             | 0–25 %                                                    |
|         | Alignment                | Left, Justify (with automatic hyphenation)                |
|         | Reading ruler            | Dims everything but the lines you are reading             |
|         | Keep code monospace      | On by default                                             |

Every control starts at **Default**, which keeps the page's own style, and has its own reset button.

**Presets**

| Preset                | Font (first available)                          | Size  | Line | Letter / word     | Paragraph | Line length | Theme |
| --------------------- | ----------------------------------------------- | ----- | ---- | ----------------- | --------- | ----------- | ----- |
| **Best for reading**  | Atkinson Hyperlegible (built in)                | 18 px | 1.6  | 0.01 em / —       | 1.5 em    | 75 ch       | Light |
| **Dyslexia-friendly** | OpenDyslexic (built in)                         | 19 px | 1.8  | 0.08 em / 0.16 em | 2 em      | 65 ch       | Sepia |
| **Night reading**     | Charter → Iowan Old Style → Literata (built in) | 18 px | 1.7  | 0.01 em / —       | 1.5 em    | 70 ch       | Dark  |

All presets use regular weight, normal style and left alignment. Values follow [WCAG 2.2 SC 1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html), the British Dyslexia Association *Dyslexia Style Guide* and common long-form typography practice. Save your own with **Save current**.

**Where changes apply**

| Scope          | Stored                       | Lasts                                      |
| -------------- | ---------------------------- | ------------------------------------------ |
| **This tab**   | Session storage              | Until the tab closes                       |
| **This site**  | Local storage, per host name | Until you forget the site                  |
| **Everywhere** | Local storage, or synced     | Until you clear it; excluded sites skip it |

The narrowest saved scope wins. Private windows never save per-site settings. Pick the default scope in **Settings**.

**Also**
- **Focus mode** shows only the article in a calm overlay with your reading settings, reading time and a Close button (<kbd>Esc</kbd>).
- **Automatic dark colours** at night: follow the system, or set a schedule.
- **Settings page**: default scope, sync across devices, excluded sites, remembered sites, presets, shortcuts, and export or import a backup.
- The toolbar badge shows when a page is restyled. A master switch pauses everything without losing it.
- Icon fonts (Font Awesome, Material Icons/Symbols, Bootstrap Icons, Remix, Codicons, …), SVG icons and code editors (Monaco, CodeMirror, Ace) are left untouched.
- Respects Windows High Contrast (forced colours): Fontwise keeps fonts and spacing but leaves colours to the system.

---

## Install

**From the stores:** Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons links will be added here once the listings are live.

**From source:**

```sh
git clone https://github.com/shaileshhatte/fontwise.git
```

| Browser                             | Steps                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, Edge, Brave, Opera, Vivaldi | Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the [`extension/`](extension) folder.                                                          |
| Firefox                             | Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select [`extension/manifest.json`](extension/manifest.json). The add-on stays until Firefox restarts. |

The same folder works in every browser.

---

## Usage

1. Open any `http://` or `https://` page and click the Fontwise toolbar icon (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>).
2. Choose where changes apply: **This tab**, **This site** or **Everywhere**.
3. Click **Best for reading**, or:
   - **Fonts**: filter, search and click a font. Click it again to remove it.
   - **Reading**: adjust text, colours and layout. Changes apply live.
4. The book icon opens **Focus mode**; the gear opens **Settings**.
5. Use the switch to pause or resume, and **Reset** to remove the changes for the selected scope.

The bar under the header summarises what is active (for example *Atkinson Hyperlegible · 18px · 1.6× line · Light*).

Browser pages (`chrome://`, `about:`), the extension stores and the built-in PDF viewer cannot be changed by any extension; the popup explains this when you open it there.

> **Firefox:** if the popup says *"Fontwise needs access to websites"*, click **Allow access**. Firefox lets you grant or revoke site access for each extension at any time.

---

## Keyboard shortcuts

| Action                                                                    | Default                                      |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| Open Fontwise                                                             | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> |
| Pause or resume on this page (applies Best for reading if nothing is set) | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> |
| Apply Best for reading                                                    | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> |
| Open or close Focus mode                                                  | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> |

On macOS, <kbd>Alt</kbd> is <kbd>Option</kbd>. Browsers skip shortcuts that clash with existing ones; change them in **Settings → Keyboard shortcuts**. Firefox for Android has no shortcuts.

---

## Permissions and privacy

| Permission                               | Why                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `storage`                                | Keep your settings, presets and the list of detected fonts.                                                  |
| `scripting`                              | Add Fontwise to tabs that were already open when it was installed or updated, and load Focus mode on demand. |
| Access to `http://*/*` and `https://*/*` | Apply your reading styles to the pages you view.                                                             |

Fontwise collects no data and makes **no network requests**: no analytics, no remote fonts, no remote code. Built-in fonts ship inside the extension. Sync, if you turn it on, uses your browser's own account sync. See [PRIVACY.md](PRIVACY.md).

---

## Accessibility

- Every control has a label. Sliders announce their values, and toggles and options announce their state.
- Full keyboard use. Arrow keys move within option groups, tabs, swatches and the font grid (up and down move by row); <kbd>Home</kbd> and <kbd>End</kbd> jump to the ends. <kbd>/</kbd> focuses search, and <kbd>Esc</kbd> clears it.
- Changes such as applied presets, search results and reset are announced through a polite live region.
- Light and dark interface following the system, a forced-colours mode, reduced motion respected everywhere, and right-to-left layouts supported.
- Focus mode is a labelled modal dialog: the page behind it is inert, <kbd>Esc</kbd> closes it, and focus returns to where it was.

---

## Browser support

| Browser                                  | Minimum version | Background context |
| ---------------------------------------- | --------------- | ------------------ |
| Chrome, Edge and other Chromium browsers | 121             | Service worker     |
| Firefox (desktop)                        | 140             | Event page         |
| Firefox for Android                      | 142             | Event page         |

One Manifest V3 `manifest.json` declares both `background.service_worker` and `background.scripts`; each browser uses the one it supports ([MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background#browser_support)). Safari is not supported yet.

---

## Development

No build step and no runtime dependencies: the extension is plain HTML, CSS and JavaScript in [`extension/`](extension). Node.js (20.19+) is used for linting, tests, vendoring and packaging.

```sh
npm install           # dev tools
npm run lint          # ESLint + Mozilla's add-on linter
npm test              # unit tests (node:test)
npm run test:e2e      # end-to-end tests in Chromium (run `npx playwright install chromium` once)
npm run vendor        # refresh built-in fonts and Readability from npm
npm run screenshots   # regenerate the store screenshots in assets/store/screenshots/
npm run video         # regenerate the promo video in assets/store/video/ (needs ffmpeg)
npm run start:firefox # launch a temporary Firefox profile with the extension
npm run start:chrome  # same for Chromium
npm run build         # dist/fontwise-<version>.zip, ready for every store
```

```
.
├── extension/               # the extension (load this folder in the browser)
│   ├── manifest.json
│   ├── _locales/en/         # all user-visible strings
│   ├── shared/              # settings model, CSS builder, catalogue, storage, i18n, UI helpers, design tokens
│   ├── scripts/             # background.js, content.js
│   ├── popup/  options/  welcome/
│   ├── fonts/  vendor/      # vendored by `npm run vendor` (OFL fonts, Readability)
│   └── icons/
├── tests/                   # unit/ (node:test) and e2e/ (Playwright)
├── tools/                   # vendor-assets.mjs, store artwork (screenshots, video)
├── assets/                  # icon sources and store artwork (not shipped)
├── docs/                    # ARCHITECTURE.md, PUBLISHING.md
└── .github/                 # CI, release workflow, issue/PR templates
```

---

## How it works

- **Shared modules** hold the validated settings model, the CSS builder and the storage layers, so the popup, settings page, background and content script all follow the same rules.
- The **content script** asks for the effective settings on each page load, re-validates them and writes one `<style>` element. The ruler and Focus mode are drawn in closed shadow roots.
- The **background** script answers those requests, keeps the badge in sync, updates open tabs when shared settings change and runs the keyboard shortcuts.

Diagrams, the data model, the CSS strategy and the design trade-offs are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Known limitations

- Only fonts from the curated catalogue are offered; other installed fonts are hidden on purpose.
- Firefox's fingerprinting protection (`privacy.resistFingerprinting`, font-visibility limits) can hide installed fonts from detection. Built-in fonts are not affected.
- Pages with a strict Content-Security-Policy may block built-in fonts or inline styles; Fontwise then falls back to the next font in the stack.
- Only the top-level page is styled, not iframes.
- After navigating, the original styling can flash briefly before settings are re-applied.
- Size, spacing and weight target body-text elements (`p`, `li`, `td`, `article`, …). Sites that put text in plain `div`s with fixed sizes may change only partly.
- Colour themes repaint element backgrounds, so some buttons and badges lose their own colour.
- Focus mode relies on Mozilla Readability and works best on articles; it reports when a page has no article.

---

## Contributing and translations

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).

Fontwise is ready for translation: every string lives in [`extension/_locales/en/messages.json`](extension/_locales/en/messages.json). Native speakers are welcome to add a locale; see CONTRIBUTING.md.

---

## Credits

Built-in fonts (SIL Open Font License 1.1): Atkinson Hyperlegible (Braille Institute of America), Lexend (The Lexend Project Authors), Literata (The Literata Project Authors) and OpenDyslexic (Abbie Gonzalez). Focus mode uses [Mozilla Readability](https://github.com/mozilla/readability) (Apache 2.0). Details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## License

[MIT](LICENSE) © 2026 Shailesh Hatte. Third-party components keep their own licences.
