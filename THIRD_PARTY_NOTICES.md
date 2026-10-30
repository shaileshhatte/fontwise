# Third-party notices

Fontwise is MIT licensed (see [LICENSE](LICENSE)). The extension package also contains the following third-party components, each under its own licence. They are copied unmodified from npm by `npm run vendor` ([tools/vendor-assets.mjs](tools/vendor-assets.mjs)).

## Fonts — SIL Open Font License 1.1

Only the Latin and Latin Extended subsets in WOFF2 format are shipped. Inside the extension they use the family names *Fontwise Atkinson Hyperlegible*, *Fontwise Lexend*, *Fontwise Literata* and *Fontwise OpenDyslexic*, so they never clash with installed copies. The fonts themselves are not modified, and they are not sold on their own.

| Font                  | Copyright                                 | npm package                         | Licence text                                             |
| --------------------- | ----------------------------------------- | ----------------------------------- | -------------------------------------------------------- |
| Atkinson Hyperlegible | © 2020 Braille Institute of America, Inc. | `@fontsource/atkinson-hyperlegible` | [OFL.txt](extension/fonts/atkinson-hyperlegible/OFL.txt) |
| Lexend                | © 2019 The Lexend Project Authors         | `@fontsource-variable/lexend`       | [OFL.txt](extension/fonts/lexend/OFL.txt)                |
| Literata              | © 2017 The Literata Project Authors       | `@fontsource-variable/literata`     | [OFL.txt](extension/fonts/literata/OFL.txt)              |
| OpenDyslexic          | © 2019 Abbie Gonzalez                     | `@fontsource/opendyslexic`          | [OFL.txt](extension/fonts/opendyslexic/OFL.txt)          |

The full licence is included next to each font: <https://openfontlicense.org>.

## Mozilla Readability — Apache License 2.0

Used by Focus mode to find the main article on a page. It runs only when you open Focus mode, and only on a copy of the page.

- Copyright (c) 2010 Arc90 Inc
- Package: `@mozilla/readability` 0.6.0
- Source: <https://github.com/mozilla/readability>
- Licence text: [extension/vendor/readability/LICENSE.md](extension/vendor/readability/LICENSE.md)

Store reviewers: `Readability.js` contains two `innerHTML` assignments (reported by `web-ext lint`). They run on the detached document clone that Readability parses, never on the live page. Fontwise then rebuilds the article from scratch in the live page, keeping only an allowlist of safe elements, attributes and URL schemes (see `rebuild()` in [extension/scripts/content.js](extension/scripts/content.js)).
