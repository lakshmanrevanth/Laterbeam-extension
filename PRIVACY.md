# CheckLater Privacy Policy

**Effective date:** 3 November 2026

This policy covers the CheckLater web app (hosted at <https://checklater-ea1ba.web.app>) and the CheckLater Chrome extension. CheckLater is an open-source project; you can read all of its code at <https://github.com/lakshmanrevanth/check-later-extension>.

If you run your own copy of CheckLater on your own Firebase project, you are the operator of that copy and this policy doesn't cover it.

## In short

- CheckLater stores only the links **you choose to save**, plus the name you sign up with.
- It does **not** collect your browsing history, has **no analytics**, shows **no ads**, and does **not sell or share** your data.
- Data is stored in Google Firebase (Cloud Firestore).

## What we store

When you create a space:

- **Your name** (the username you type, 2–32 characters)
- Your **space code**, which is the id of your space
- Your **category list** and the time the space was created

For each link you save:

| Field | What it is |
|---|---|
| URL | The link you saved, with tracking parameters such as `utm_*` and `fbclid` removed |
| Title | The page title, or the title you typed |
| Note | Your optional note. When you save selected text from the right-click menu, that text becomes the note. Links shared from a phone app may include the shared caption. |
| Category | The category you picked or that was suggested |
| Domain | The website's domain, e.g. `youtube.com` |
| Favicon URL | A link to the site's icon on Google's favicon service |
| Source | Where you saved it from: web, extension or share |
| Status, pinned | Whether it's still to check or done, and whether it's pinned |
| Timestamps | When it was created and last updated |

## Where it's stored

All of this is stored in **Google Cloud Firestore**, part of Google Firebase, in the project that runs CheckLater. Google processes the data as our infrastructure provider and, like any web service, receives standard request information such as your IP address. See [Firebase's privacy and security information](https://firebase.google.com/support/privacy).

Each device signs in with **Firebase Anonymous Authentication**, which creates a random user identifier for that device. It isn't linked to your name, email or Google account. Your space is identified by its code, not by this identifier.

On your devices, CheckLater keeps:

- **Web app:** your code and name in the browser's local storage, and an offline copy of your links in the browser's storage (Firestore offline cache), plus your theme choice.
- **Extension:** your code, name, categories and Firebase sign-in tokens in `chrome.storage.local`.

## Who can see your data

Anyone who has your **space code** can read and change the links in that space. Treat the code like a password and don't share it publicly. We don't share your data with anyone else.

## Favicons

To show website icons, CheckLater loads them from Google's favicon service (`https://www.google.com/s2/favicons`). That request tells Google the **domain** of each saved link (not the full URL) when the icon is displayed. The extension popup does the same for the current page if Chrome doesn't provide an icon itself.

## What we don't do

- No browsing history. CheckLater only stores pages you explicitly save.
- No analytics, tracking pixels or advertising.
- No selling, renting or sharing of your data with third parties.
- No use of your data for credit, lending or any purpose unrelated to saving links.

## Chrome extension permissions

| Permission | Why it's needed |
|---|---|
| `activeTab` | Reads the current tab's URL and title, **only** when you click the toolbar button, use the right-click menu or press a keyboard shortcut. While the popup is open, it also checks your space for that URL to warn about duplicates. Nothing is saved unless you save it. |
| `contextMenus` | Adds the **Send to CheckLater** right-click menu for pages, links, images, videos and selected text. |
| `storage` | Keeps your space code, name, categories and Firebase sign-in token on this computer, so you stay signed in. |
| `https://firestore.googleapis.com/*` | Reads and writes your saved links in Cloud Firestore. |
| `https://identitytoolkit.googleapis.com/*` | Creates the anonymous Firebase sign-in for this browser. |
| `https://securetoken.googleapis.com/*` | Refreshes that sign-in token when it expires. |

The extension doesn't read page content, run on pages in the background, or load remote code.

## Deleting your data

- **Links:** delete any item in the web app; it's removed from Firestore and from every device.
- **Local data:** sign out in the web app or clear site data, and remove the extension, to delete everything stored on your devices.
- **Your whole space** (name and categories): this can't yet be done from the app. To have a space deleted, open an issue at <https://github.com/lakshmanrevanth/check-later-extension/issues> asking for deletion **without posting your code**, and we'll arrange a private way to confirm it. Delete your items in the app first.

## Children

CheckLater isn't directed at children under 13, and we don't knowingly collect their data.

## Changes

If this policy changes, we'll update it here and in the repository, with a new effective date. Significant changes will be noted in the [changelog](CHANGELOG.md).

## Contact

Questions or requests: open an issue at <https://github.com/lakshmanrevanth/check-later-extension/issues>. For security issues, see [SECURITY.md](SECURITY.md).
