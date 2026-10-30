# Publishing Fontwise

How to release Fontwise to the **Chrome Web Store** (CWS), **Microsoft Edge Add-ons** and **Firefox Add-ons** (AMO). The same zip is uploaded to every store.

---

## 1. Pre-flight checklist

- [ ] `version` in [`extension/manifest.json`](../extension/manifest.json) is bumped (first release: `1.0.0`).
- [ ] [CHANGELOG.md](../CHANGELOG.md) has an entry for that version and date.
- [ ] `npm run lint` passes: 0 errors. Expected warnings: `BACKGROUND_SERVICE_WORKER_IGNORED` and 2× `UNSAFE_VAR_ASSIGNMENT` in the vendored Readability (see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)).
- [ ] `npm test` and `npm run test:e2e` pass.
- [ ] The [manual test checklist](../CONTRIBUTING.md#manual-test-checklist) passes in Chrome and Firefox.
- [ ] `npm run build` produced `dist/fontwise-<version>.zip`.
- [ ] [PRIVACY.md](../PRIVACY.md) is public at <https://github.com/shaileshhatte/fontwise/blob/main/PRIVACY.md>.
- [ ] GitHub repository settings: description, topics (`browser-extension`, `accessibility`, `readability`, `fonts`, `dyslexia`, `reader-mode`), **Private vulnerability reporting** enabled (Settings → Code security), branch protection on `main` requiring both CI jobs.
- [ ] Store artwork is ready (see [§5](#5-store-assets)).

Tagging `v<version>` and pushing the tag runs the *Release* workflow. It checks that the tag matches the manifest, builds the zip and attaches it to a GitHub release, so the uploaded package can be traced back to the source.

---

## 2. Chrome Web Store

1. Register in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time registration fee).
2. **Items → New item** and upload `dist/fontwise-<version>.zip`.
3. **Store listing**
   - *Description*: [§6 Full description](#full-description).
   - *Category*: **Accessibility**.
   - *Language*: English.
   - *Store icon*: `assets/store/store-icon-128.png`.
   - *Screenshots*: up to 5 images at 1280 × 800; use the Chrome set from [§5](#5-store-assets).
   - *Small promo tile*: `assets/store/promo-small-440x280.png`.
   - *Homepage / support URL*: <https://github.com/shaileshhatte/fontwise> and <https://github.com/shaileshhatte/fontwise/issues>.
4. **Privacy practices**
   - *Single purpose* and *Permission justifications*: [§6](#single-purpose).
   - *Remote code*: **No, I am not using remote code.**
   - *Data usage*: tick no data types; certify the three disclosures.
   - *Privacy policy URL*: public URL of `PRIVACY.md`.
5. **Distribution**: Public, all regions. Submit for review.

Broad host access (`http://*/*`, `https://*/*`) can lead to a longer in-depth review; the justification explains why it is needed.

---

## 3. Microsoft Edge Add-ons

1. Register in [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) (free).
2. **Create new extension** and upload the same zip.
3. *Availability*: Public, all markets.
4. *Properties*: Category **Accessibility**; privacy policy URL = public `PRIVACY.md`; website and support URLs as above. *Does this extension access, collect or transmit personal information?* **No.**
5. *Store listing*: reuse the descriptions from [§6](#6-listing-copy), the 128 px store icon, the 440 × 280 promo tile and the screenshots.
6. *Notes for certification*: paste [§6 Notes to reviewer](#notes-to-reviewer). Submit.

Edge also accepts listings from the Chrome Web Store, but publishing in Partner Center gives Edge users native updates and reviews.

---

## 4. Firefox Add-ons (AMO)

1. Sign in to the [Add-on Developer Hub](https://addons.mozilla.org/developers/) (free).
2. **Submit a New Add-on → On this site** (listed) and upload the zip.
3. Compatibility: **Firefox** and **Firefox for Android** (manifest minimums 140 and 142).
4. *Do you need to submit source code?* **No.** The package is unminified source with no build step. The vendored files are unmodified copies from npm: `@mozilla/readability` 0.6.0 and the `@fontsource` fonts. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
5. **Listing details**
   - *Name*: taken from the manifest (`Fontwise — Readable Fonts & Reading Mode`).
   - *Summary*: [§6 Short description](#short-description).
   - *Description*: [§6 Full description](#full-description).
   - *Categories*: **Appearance**, **Other**.
   - *Support website*: <https://github.com/shaileshhatte/fontwise/issues>.
   - *License*: **MIT License**.
   - *Privacy policy*: paste the text of `PRIVACY.md`.
   - *Notes to reviewer*: [§6](#notes-to-reviewer).
6. After approval, add all seven screenshots from [§5](#5-store-assets) on the listing page.

The manifest declares `data_collection_permissions: { required: ["none"] }`, so Firefox shows "no data collected" during installation.

Opera ([addons.opera.com](https://addons.opera.com/developer/)) accepts the same zip; use the same listing text if you publish there.

---

## 5. Store assets

| Asset                        | File                                                               | Used by                |
| ---------------------------- | ------------------------------------------------------------------ | ---------------------- |
| Store icon 128 × 128         | `assets/store/store-icon-128.png`                                  | CWS, Edge              |
| Small promo tile 440 × 280   | `assets/store/promo-small-440x280.png` (source: `promo-small.svg`) | CWS, Edge              |
| Extension icons 16/32/48/128 | `extension/icons/` (taken from the package)                        | all                    |
| Large icon renders           | `assets/icons/icon-256.png`, `icon-512.png`, `icon-1024.png`       | social preview, README |
| Screenshots 1280 × 800       | `assets/store/screenshots/fontwise-*.png` (source: `npm run screenshots`) | all              |

The screenshots are generated by [`tools/store-screenshots.mjs`](../tools/store-screenshots.mjs): it loads the extension in Playwright's Chromium, captures the real popup, page, Focus mode and settings on a fictional demo article (original text, `dailyledger.example`, no third-party content), then adds headlines, numbered callouts and arrows. Rerun `npm run screenshots` after UI or copy changes (needs `npx playwright install chromium`).

| # | File                              | Shows                                                         | Chrome (max 5) |
| - | --------------------------------- | ------------------------------------------------------------- | -------------- |
| 1 | `fontwise-1-before-after.png`     | An article before and after **Best for reading**              | ✓              |
| 2 | `fontwise-2-fonts.png`            | Popup **Fonts** view: scope, presets, search, dyslexia fonts  | ✓              |
| 3 | `fontwise-3-text-spacing.png`     | Popup **Reading** view: size and spacing sliders              | ✓              |
| 4 | `fontwise-4-colours.png`          | Themes, palettes and the WCAG contrast check                  |                |
| 5 | `fontwise-5-layout-ruler.png`     | Line length, margins and the reading ruler on the page        | ✓              |
| 6 | `fontwise-6-focus-mode.png`       | **Focus mode** with the Night reading preset                  | ✓              |
| 7 | `fontwise-7-settings.png`         | **Settings**: scope, sync, automatic dark, sites, shortcuts, backup |          |

Edge (up to 10) and AMO accept all seven, in order.

---

## 6. Listing copy

### Name

```
Fontwise — Readable Fonts & Reading Mode
```

### Short description

(132 characters max on CWS, taken from the manifest; 250 on AMO)

```
Readable fonts, better spacing, calm colours and a distraction-free Focus mode for any web page. No data collected.
```

### Full description

```
Fontwise makes any web page easier to read — in one click, or exactly the way you like it.

ONE-CLICK PRESETS
• Best for reading — Atkinson Hyperlegible, comfortable size, spacing and line length on a soft light background.
• Dyslexia-friendly — OpenDyslexic, larger and more widely spaced text on cream, following the British Dyslexia Association style guide and WCAG text-spacing guidance.
• Night reading — a serif reading font on a dark background.
• Save your own presets.

FONTS
• Four reading fonts built in, nothing to install: Atkinson Hyperlegible, Lexend, Literata and OpenDyslexic.
• Finds which of 84 more hand-picked readable typefaces are installed on your computer, including fonts for Chinese, Japanese, Korean, Arabic, Devanagari and Hebrew.
• Search, live previews, and Sans-serif / Serif / Mono groups.

READING CONTROLS
• Font size, line, letter, word and paragraph spacing, weight and italic.
• Line length, margins, and left or justified alignment.
• Light, Sepia, Dark and High-contrast themes, or your own colours with a live contrast check.
• Reading ruler that dims everything but the lines you are reading.
• Keeps code monospace and leaves icons untouched.

FOCUS MODE
• Shows just the article — no ads, sidebars or pop-ups — in your chosen font and colours, with reading time.

YOUR WAY
• Apply changes to this tab, this site, or everywhere.
• Automatic dark colours at night (follow the system or set a schedule).
• Keyboard shortcuts, sync across devices (optional), backup and restore.

ACCESSIBLE
• Full keyboard control, screen-reader labels and announcements, high-contrast and reduced-motion support.

PRIVATE BY DESIGN
• No data collection, no analytics, no network requests, no remote code.
• Site settings never leave your device and are never saved from private windows.
• Open source under the MIT license.
```

### Single purpose

```
Fontwise improves the readability of web pages: it changes their typography, colours and layout, and can show the main article in a distraction-free reading view.
```

### Permission justifications

| Permission                                   | Justification                                                                                                                                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                    | Stores the user's reading settings (per tab in session storage; per site and "everywhere" locally or in browser sync if the user enables it), the user's presets and preferences, and a cache of detected installed fonts. Nothing is sent to any server.  |
| `scripting`                                  | Injects Fontwise's own packaged content script into tabs that were open before installation or an update, and loads the packaged Mozilla Readability library only when the user opens Focus mode. No remote code is executed.                              |
| Host permissions `http://*/*`, `https://*/*` | The single purpose is to make the page the user is reading easier to read, which can be any website. The content script adds a `<style>` element with the user's typography and, on request, a reading view. It does not collect or transmit page content. |

### Notes to reviewer

```
How to test:
1. Open any article (e.g. https://en.wikipedia.org/wiki/Typography).
2. Click the Fontwise toolbar icon, press "Best for reading", or pick a font (Fonts tab) and adjust sliders (Reading tab).
3. The book icon in the popup opens Focus mode (Esc closes it). The gear opens Settings.
4. Reset in the popup removes the changes.

The package is the original, unminified source; there is no build step. Repository: https://github.com/shaileshhatte/fontwise
Third-party files are unmodified copies from npm: extension/vendor/readability (Mozilla Readability 0.6.0, Apache-2.0) and extension/fonts (Atkinson Hyperlegible, Lexend, Literata, OpenDyslexic from @fontsource, SIL OFL 1.1). The two innerHTML warnings are inside Readability.js and operate on a detached document clone; Fontwise rebuilds the article with createElement and an allowlist before showing it.
The extension makes no network requests and collects no data. Installed-font detection measures text widths on a canvas inside the popup only.
```

---

## 7. After publishing

- Add the store links to the *Install* section of the [README](../README.md).
- For updates: bump `version`, update the changelog, tag, and upload the new zip to each dashboard. The stores keep the same listing and id across versions. Never change the Firefox add-on id `fontwise@shailesh-hatte` after the first upload.
