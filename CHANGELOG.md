# Changelog

All notable changes to Fontwise are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-30

Initial release.

### Added
- **Fonts:** four built-in reading fonts (Atkinson Hyperlegible, Lexend, Literata, OpenDyslexic; SIL OFL 1.1) plus detection of 84 more highly readable installed typefaces: 61 Latin and 23 for CJK, Arabic, Devanagari and Hebrew. System Sans, Serif and Mono defaults are always available. The picker has Sans-serif, Serif and Mono groups, search, live previews and badges; **Rescan** detects fonts installed later.
- **Reading controls:** font size, line, letter, word and paragraph spacing, weight, style, line length (45–100 characters), margin width and alignment (left, or justify with hyphenation).
- **Colours:** Light, Sepia, Dark and High contrast themes, and custom text and background colours with a live WCAG contrast check.
- **Presets:** *Best for reading*, *Dyslexia-friendly* and *Night reading*, plus your own presets via **Save current**.
- **Scopes:** apply changes to *This tab*, *This site* or *Everywhere*; the narrowest saved scope wins. Excluded sites skip *Everywhere*. Private windows never save site settings.
- **Focus mode:** a distraction-free reader built on Mozilla Readability, using your reading settings, with reading time and <kbd>Esc</kbd> to close.
- **Reading ruler** that dims everything but the lines being read; it follows the pointer and keyboard focus.
- **Automatic dark colours** that follow the system or a schedule.
- **Settings page:** default scope, optional sync across devices, automatic dark, *Everywhere* settings, remembered and excluded sites, presets, keyboard shortcuts, and JSON export/import.
- **Welcome page** on first install.
- **Keyboard shortcuts:** open Fontwise (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>), pause/resume (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>), Best for reading (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>) and Focus mode (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>).
- A toolbar badge when a page is restyled; master on/off switch; per-control reset.
- *Keep code monospace* (on by default) for `pre`/`code` and the Monaco, CodeMirror and Ace editors. Icon fonts and SVG icons are left untouched.
- **Accessibility:** labelled controls; arrow-key navigation in every option group, tab list and the font grid; announcements through a live region; spoken slider values; visible focus; and reduced-motion, forced-colours and right-to-left support. The interface follows the system light or dark theme.
- **Localisation-ready:** every string is in `_locales/en/messages.json`.
- Settings stay live across tabs: changing *Everywhere* or site settings updates open pages. Pages restored from the back/forward cache refresh, and tabs left over from a previous version are restyled after an update.
- One Manifest V3 package for Chrome and Edge 121+, Firefox 140+ and Firefox for Android 142+.
- Privacy by design: no network requests, no data collection, minimal permissions (`storage`, `scripting`, http/https host access). Every setting is validated before it becomes CSS, and imported backups are fully re-validated.
- Unit tests (`node:test`) and end-to-end tests (Playwright, Chromium) in CI.

[Unreleased]: https://github.com/shaileshhatte/fontwise/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/shaileshhatte/fontwise/releases/tag/v1.0.0
