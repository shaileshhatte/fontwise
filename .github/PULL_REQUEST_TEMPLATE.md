## What and why

<!-- Describe the change and the problem it solves. Link related issues (e.g. "Fixes #12"). -->

## How it was tested

- [ ] `npm run lint`, `npm test` and `npm run test:e2e` pass
- [ ] Tested in Chrome (load unpacked `extension/`)
- [ ] Tested in Firefox (temporary add-on `extension/manifest.json`)
- [ ] Ran the relevant parts of the [manual test checklist](../blob/main/CONTRIBUTING.md#manual-test-checklist)

## Checklist

- [ ] No new permissions, or the reason is explained above
- [ ] Untrusted values go through `Fontwise.sanitizeSettings()`; page content is never inserted with `innerHTML` or by moving parsed nodes
- [ ] No remote code, network requests or web fonts
- [ ] New controls are labelled, keyboard-operable, announced and visible in forced-colours mode
- [ ] New text is in `_locales/en/messages.json`
- [ ] Tests added or updated
- [ ] `CHANGELOG.md` updated under *Unreleased* for user-visible changes
- [ ] Docs updated (README, docs/ARCHITECTURE.md) if behaviour changed
