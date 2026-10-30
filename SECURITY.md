# Security Policy

## Supported versions

| Version              | Supported |
| -------------------- | --------- |
| 1.x (latest release) | ✅         |

Only the latest published version in the Chrome Web Store, Microsoft Edge Add-ons and on addons.mozilla.org receives fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report it privately through GitHub: [**Report a vulnerability**](https://github.com/shaileshhatte/fontwise/security/advisories/new) (also on the repository's **Security** tab). Include:

- the affected version and browser,
- a description of the issue and its impact,
- steps or a proof of concept to reproduce it.

You can expect an acknowledgement within 7 days and a status update within 30 days. Once a fix is released you will be credited in the changelog unless you prefer otherwise.

## Scope

In scope:

- Injection through settings: any way to get unvalidated text into the CSS that Fontwise writes into pages, including through presets, imported backups or synced data.
- Focus mode: any way for page content to run script, load an unsafe URL or escape the reader's allowlist (`rebuild()` in `scripts/content.js`).
- Data leaving the device: Fontwise makes no network requests; any path that causes one is a bug. Per-site settings must never reach `storage.sync`, and private windows must never write them.
- Privilege issues: content-script or message-passing behaviour that lets a web page read or change Fontwise settings, or trigger extension actions.
- Permissions broader than those documented in the README.

Out of scope:

- Pages that intentionally override or remove Fontwise's styles.
- Fingerprinting through installed-font detection. Detection runs only inside the extension popup and its results are never exposed to web pages.
- Detecting that Fontwise is installed by probing its web-accessible font files (documented in [PRIVACY.md](PRIVACY.md)).
- Vulnerabilities in Mozilla Readability itself; report those to [mozilla/readability](https://github.com/mozilla/readability). We will update the vendored copy.
