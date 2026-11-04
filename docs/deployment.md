# Deploying Laterbeam

This guide sets up your own Laterbeam: a Firebase project for the backend and hosting, the web app, and optionally the Chrome Web Store listing. It takes about 15 minutes. The free Firebase **Spark** plan is enough for personal use.

Requirements: Node.js 22+, a Google account, and the repository cloned with `npm install` done.

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and click **Create a project**.
2. Pick a name. The project id becomes your default URL: `https://<project-id>.web.app`.
3. Google Analytics is not used by Laterbeam; you can turn it off.

## 2. Enable Anonymous sign-in

**Build → Authentication → Get started → Sign-in method →** enable **Anonymous** and save.

Every device signs in anonymously. Without this, the apps show "Enable Anonymous sign-in in Firebase Authentication".

## 3. Create the Firestore database

**Build → Firestore Database → Create database.**

- Choose a location close to your users. It can't be changed later.
- Start in **production mode**. The real rules are deployed in step 6 from `firestore.rules`.

## 4. Register a web app and fill in `.env`

1. **Project settings (⚙) → General → Your apps →** click the **Web** (`</>`) icon. Register an app (no need to set up Firebase Hosting here).
2. Copy the `firebaseConfig` values into `.env`:

   ```bash
   cp .env.example .env
   ```

   | `.env` key | `firebaseConfig` field |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |
   | `VITE_WEB_APP_URL` | `https://<project-id>.web.app/` (or your custom domain) |

3. Run `npm run sync`. It generates `shared/config.js` and copies `shared/` into the extension.

> **The API key is not a secret.** A Firebase web API key only identifies your project and ships to every browser anyway. Access is controlled by `firestore.rules`, and you can add App Check (step 8) to block scripted abuse. `.env` is gitignored so each fork points at its own project, not to hide the key.

## 5. Connect the Firebase CLI

```bash
npm install -g firebase-tools     # or use npx firebase …
firebase login
firebase use --add                # pick your project, alias e.g. "default"
```

`firebase use --add` writes `.firebaserc`, which is gitignored. You can also copy `.firebaserc.example` to `.firebaserc` and put in your project id.

## 6. Deploy

```bash
npm run deploy
```

This builds the web app into `web/dist` and runs `firebase deploy`, which publishes:

- **Hosting:** the web app, the privacy page at `/privacy`, and the security headers and CSP from `firebase.json`
- **Firestore rules and indexes:** `firestore.rules`, `firestore.indexes.json`

Open `https://<project-id>.web.app`, create a space, and save a link. To deploy only part of it: `firebase deploy --only hosting` or `--only firestore:rules`.

## 7. Optional: custom domain

1. **Hosting → Add custom domain**, then follow the DNS steps (TXT for verification, then A records). The SSL certificate is issued automatically, which can take up to a day.
2. **Authentication → Settings → Authorized domains:** add the domain.
3. Set `VITE_WEB_APP_URL` to the new URL, run `npm run deploy`, and rebuild the extension (`npm run sync` / `npm run package`) so its **Open app** link points there.

## 8. Enable App Check (recommended)

The API key is public, so without App Check anyone can call your Firestore and Auth APIs directly from a script. That doesn't let them into spaces they don't have the code for, but it does allow bulk traffic: mass anonymous sign-ups, junk spaces, attempts to guess codes, and the bills or quota exhaustion that come with them. App Check makes Firebase accept only requests from your real web app.

1. In Google Cloud, enable **reCAPTCHA Enterprise** for the project and create a **website key** for your hosting domain(s).
2. **Firebase console → App Check → Apps →** register the web app with the **reCAPTCHA Enterprise** provider and that site key.
3. Put the site key in `.env` as `VITE_APP_CHECK_SITE_KEY` and redeploy (`npm run deploy`). The web app turns on App Check automatically when this key is set, and `firebase.json`'s CSP already allows the reCAPTCHA scripts.
4. Watch **App Check → APIs → Cloud Firestore / Authentication** metrics for a few days, then click **Enforce**.

> **Extension caveat:** the extension uses the REST API and can't run reCAPTCHA, so enforcing App Check on Firestore and Auth blocks it unless you add a supported attestation path for it, such as debug tokens for development, or a custom provider backed by a Cloud Function. Test the extension before you enforce.

## 9. Publish the Chrome extension

1. Make sure `.env` points at the production project, then run:
   ```bash
   npm run package
   ```
   This creates `release/laterbeam-extension-v<version>.zip`, with the manifest version taken from `package.json`.
2. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and pay the one-time **$5** registration fee if you haven't already.
3. **New item →** upload the zip.
4. Fill in the listing from [chrome-web-store.md](chrome-web-store.md): description, category, screenshots from `docs/screenshots/`, single purpose, permission justifications, and data-usage answers.
5. **Privacy policy URL:** `https://<project-id>.web.app/privacy`.
6. Submit for review. Reviews usually take a few days. For updates, bump the version, run `npm run package` and upload the new zip.

Until it's published, anyone can load `extension/` unpacked (after `npm run sync`) or unzip a release zip and load that folder.

## 10. Install on phones

- **Android (Chrome):** open your URL, then **⋮ → Install app** (or **Add to Home screen**). Laterbeam then shows up in the **Share** menu of other apps.
- **iPhone/iPad (Safari):** **Share → Add to Home Screen**. iOS doesn't let web apps receive shares, so use **+** and **Paste**.
- **Linking a device:** on a signed-in device, open the account sheet and scan its QR code, or type the code.

## 11. Cut a release

1. Bump `"version"` in `package.json` (e.g. `1.0.1`). `npm run package` copies it into `extension/manifest.json`.
2. Move the **Unreleased** entries in `CHANGELOG.md` under a new `## [1.0.1] - YYYY-MM-DD` heading and update the compare links.
3. Commit, then tag and push:
   ```bash
   git tag v1.0.1
   git push && git push --tags
   ```
4. The **Release** workflow (`.github/workflows/release.yml`) runs tests, builds, packages, and creates a GitHub release with the extension zip attached and generated notes.
5. Deploy the web app (`npm run deploy`) and upload the zip to the Chrome Web Store.

**CI configuration:** the workflows write `.env` from repository **variables**. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` and `VITE_WEB_APP_URL` under **Settings → Secrets and variables → Actions → Variables**. Without them CI still runs tests, but release zips won't be connected to your project.
