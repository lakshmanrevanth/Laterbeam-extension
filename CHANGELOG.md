# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-03

### Added
- **Redesigned web app:** sidebar layout on desktop, and items grouped by date (Pinned, Today, Yesterday, This week, Earlier).
- **Demo mode:** open `/?demo` to try the app on sample data held in memory, with no Firebase connection.
- **Import:** load links from a CheckLater JSON export.
- **Theme switch:** light, dark or follow the system.
- **Keyboard shortcuts:** `/` to search, `n` to add a link, `Esc` to close dialogs.
- **Privacy policy page** at `/privacy`.
- **Optional Firebase App Check:** set `VITE_APP_CHECK_SITE_KEY` to turn it on in the web app.
- **Screenshot pipeline:** `npm run screenshots` regenerates README and Chrome Web Store images from demo mode. It fails on any page error or CSP violation.
- **Extension prototypes** in `docs/prototypes/`. The extension popup was redesigned with a smart-pick label, icons and a clearer saved state.
- **Extension packaging script:** `npm run package` builds `release/checklater-extension-v<version>.zip` and syncs the manifest version from `package.json`.
- **CI and release workflows:** GitHub Actions run tests, build and package on every push and PR. Tags `v*` publish a GitHub release with the extension zip attached.
- **Docs:** contributing guide, security policy, privacy policy, architecture, deployment and Chrome Web Store guides, issue and PR templates.

### Changed
- Firebase config now lives in a gitignored `.env` (see `.env.example`). `npm run sync` generates `shared/config.js` and the extension copy from it.
- Firestore rules are stricter: `source`, `domain`, `favicon`, `updatedAt` and `remindAt` are type-checked, URLs must be http(s), and a space needs at least one category.
- The service worker cache is versioned, so new releases replace old cached files.
- Node.js 22+ is required.
- The web app loads the Firebase SDK on demand, cutting the first download from about 690 KB to about 50 KB.

### Security
- Security headers, including a Content Security Policy, on Firebase Hosting.

## [0.1.0] - 2026-10-21

### Added
- Sign up with a name and get a unique 12-character code. Sign in on any number of devices with it (typed, QR code or `?code=` link).
- Save from the Chrome extension popup (editable title, note, category), the right-click menu (page, link, image or selection) or the `Alt+Shift+D` quick-save shortcut.
- Save from any Android app via the Share menu (installable PWA share target). Paste or add links by hand in the web app.
- Smart categories: YouTube goes to Watch, Amazon to Shopping, Google Docs and PDFs to Docs, GitHub to Work, blogs to Read.
- Custom categories. When you delete a category, its links move to another one.
- Duplicate detection, and removal of `utm_*`/`fbclid` tracking parameters.
- "To check" and "Done" views. Mark done with Undo, pin, move category, edit, share, copy, delete with Undo.
- Instant search across title, URL, note and category.
- Live sync across devices, offline support and a sync status dot.
- Export everything as JSON. Installable PWA with light and dark mode.

[Unreleased]: https://github.com/lakshmanrevanth/check-later-extension/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lakshmanrevanth/check-later-extension/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/lakshmanrevanth/check-later-extension/releases/tag/v0.1.0
