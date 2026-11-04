# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | ✅ |
| < 1.0 | ❌ |

Fixes land on `main` and ship in the next 1.x release of the extension and the hosted web app.

## Reporting a vulnerability

**Please don't open a public issue.** Report privately through GitHub:

1. Go to <https://github.com/lakshmanrevanth/check-later-extension/security/advisories/new> (**Security → Report a vulnerability**).
2. Describe the issue, how to reproduce it, and the impact you expect.

Never include a real person's space code in a report; create a test space instead.

You can expect an acknowledgement within a few days. Once a fix is ready we'll publish an advisory and credit you unless you prefer to stay anonymous. This is a volunteer project, so there is no bug bounty.

## Security model

Laterbeam has no passwords. Access to a space is controlled by its code.

- **The code is a bearer secret.** A space code like `K7QM-2HXP-9WAD` is 12 characters from a 32-character alphabet, so about 60 bits of randomness, generated with `crypto.getRandomValues`. Anyone who has the code can read and edit that space, exactly like a password.
- **Anonymous Firebase Auth per device.** Every client signs in anonymously before talking to Firestore, so unauthenticated raw traffic is rejected. The anonymous identity is not tied to a space; the code is.
- **Spaces can't be listed.** Firestore rules allow fetching `spaces/{code}` only by its exact id (`allow list: if false`), and there is no collection-group rule, so codes and items can't be enumerated or queried across spaces.
- **Writes are validated.** Rules check the code format, allowed field names, types and sizes for spaces and items, and only the category list of a space can change after it is created.
- **The Firebase web API key is not a secret.** It identifies the project; security comes from `firestore.rules`. Enabling [App Check](docs/deployment.md#8-enable-app-check-recommended) is recommended to limit who can call the API.
- **Hosting headers.** The web app is served with a Content Security Policy and other security headers (see `firebase.json`). No inline scripts or styles are allowed.
- **Extension.** The extension runs no remote code, asks only for `activeTab`, `contextMenus` and `storage`, and talks only to Google's Firestore and Firebase Auth endpoints.

## Known limitations

- **No rate limiting** until App Check is enabled on the Firebase project. Without it, anyone with the public API key can script requests (for example, guessing codes, though 60 bits makes that impractical, or creating many spaces).
- **Anyone with the code has full access.** They can read, add, edit and delete every item in that space. There are no per-device permissions and no read-only sharing.
- **Codes can't be rotated yet.** If your code leaks, the only remedy today is to create a new space, move your links (export and import JSON), and delete the items from the old one.
- **No account recovery.** If you lose the code and every signed-in device, the space can't be recovered.
- **Favicons** are loaded from Google's favicon service, which reveals saved domains to Google (see [PRIVACY.md](PRIVACY.md)).
