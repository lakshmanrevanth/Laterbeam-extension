# Contributing to Laterbeam

Thanks for helping! Bug reports, fixes, docs and small features are all welcome. For anything large, open an issue first so we can agree on the approach before you write code.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## Development setup

Requirements: **Node.js 22+**, Chrome, and a Firebase project you control (free Spark plan is enough; see [docs/deployment.md](docs/deployment.md) steps 1–4).

```bash
git clone https://github.com/lakshmanrevanth/check-later-extension.git
cd check-later-extension
npm install
cp .env.example .env      # fill in your Firebase web app config
npm run dev               # web app on http://localhost:5173 (plus a LAN URL for your phone)
```

Don't want to set up Firebase yet? Open <http://localhost:5173/?demo>: the app runs on sample data in memory and never talks to Firebase.

**Extension:** run `npm run sync`, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the `extension/` folder. After changing anything in `shared/` or `.env`, run `npm run sync` again and click the reload icon on the extension card.

`npm run sync` generates `shared/config.js` from `.env` and copies `shared/` into `extension/lib/shared/`. Both outputs are generated and gitignored; never edit or commit them.

## Project layout

```
shared/        Logic used by both apps: codes, smart categories, URL cleaning, item shape
web/           PWA: index.html, src/ (main.js UI, db.js Firebase data layer, styles.css), public/ (sw.js, manifest, icons, privacy page)
extension/     Chrome MV3 extension: popup, background.js (context menu + quick-save), lib/api.js (Firestore REST client)
scripts/       sync, icon generator, packaging, screenshots
tests/         node:test unit tests
docs/          architecture, deployment, Chrome Web Store listing, screenshots
firestore.rules   security rules (the real access control)
firebase.json     hosting config, security headers / CSP
```

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Sync, then start the Vite dev server |
| `npm run build` | Production build into `web/dist` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Sync, then run unit tests |
| `npm run sync` | Generate `shared/config.js` from `.env` and copy `shared/` into the extension |
| `npm run icons` | Regenerate PNG icons |
| `npm run package` | Zip `extension/` into `release/laterbeam-extension-v<version>.zip` (manifest version synced from `package.json`) |
| `npm run screenshots` | Regenerate `docs/screenshots/*.png` from demo mode |
| `npm run deploy` | Build and `firebase deploy` (hosting + rules) |

## Coding conventions

- **Plain JavaScript, ES modules.** No framework, no TypeScript, no CSS preprocessor. Keep dependencies to a minimum; every new one needs a reason.
- **Shared logic goes in `shared/`.** If both the web app and the extension need it (parsing, validation, categorisation), put it there and test it. `shared/` must not import Firebase or browser-only APIs beyond standard Web APIs, so it runs in Node tests, the page and the extension service worker.
- **Keep the extension build-free.** MV3 cannot load remote code, and `extension/` is loaded as-is. Use relative imports and the Firestore REST API, not the Firebase SDK.
- **No inline scripts or styles** in HTML served by Hosting: the CSP blocks them. Use files and classes.
- **Never render untrusted text as HTML** without escaping. Titles, notes and URLs come from other devices and other websites.
- Match the existing style: 2-space indent, single quotes, semicolons, small functions. `.editorconfig` covers whitespace.
- UI must work at phone width and in both light and dark themes.

## Testing

```bash
npm test
```

Add or update tests in `tests/` for any change to `shared/` or to the REST encoding in `extension/lib/api.js`. UI changes are tested by hand: check the web app (including `/?demo`) and the unpacked extension, and attach screenshots to the PR.

## Changing Firestore rules safely

`firestore.rules` is the only thing standing between the public API key and the data, so treat changes as security changes.

1. Keep the invariants: spaces are never listable (`allow list: if false`), there is no collection-group rule, and every write is field-validated.
2. Old clients stay in the wild (installed extensions update slowly). A rule change must accept what the currently released extension and web app write, or ship together with a client change and a migration note.
3. Test locally with the emulator before deploying:
   ```bash
   npx firebase emulators:start --only firestore
   ```
   and exercise create/read/update/delete from the web app and the extension against it, or use the Rules Playground in the Firebase console.
4. Deploy rules on their own first: `npx firebase deploy --only firestore:rules`, then check both clients against production.
5. Explain the change in the PR description and in `CHANGELOG.md`.

## Commits and pull requests

- Branch from `main`; keep each PR focused on one change.
- Write commit messages in the imperative mood with a short subject line, e.g. `Fix duplicate detection for youtu.be links`. Optional prefixes like `fix:`, `feat:`, `docs:` are fine.
- Make sure `npm test` and `npm run build` pass; CI runs both plus `npm run package`.
- Add a line under **Unreleased** in `CHANGELOG.md` for user-visible changes.
- Never commit `.env`, generated files, `release/` zips, or anyone's space code.
- Fill in the PR template; include screenshots for UI changes.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
