# Chrome Web Store listing

Ready-to-paste text for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Upload `release/checklater-extension-v<version>.zip` from `npm run package` (see [deployment.md](deployment.md#9-publish-the-chrome-extension)).

## Store listing

**Name**

```
CheckLater
```

**Short description** (summary, ≤ 132 characters, currently 112)

```
Save any page or link in one click and open it later on your phone or any device. No account or password needed.
```

**Detailed description**

```
CheckLater is a simple "read it later" inbox for links. Save a page from Chrome, then open it later on your phone, tablet or another computer.

HOW IT WORKS
• Sign up with just a name and get a unique code like K7QM-2HXP-9WAD. No email or password.
• Enter the same code in the CheckLater web app on your phone or other computers. All your links sync live.
• Install the web app on Android to save links from any app's Share menu: YouTube, Instagram, WhatsApp and more.

SAVE FROM CHROME
• Click the toolbar button to save the current page, with an editable title, note and category.
• Right-click any page, link, image or selected text → Send to CheckLater → pick a category.
• Press Alt+Shift+D to quick-save the current page, or Alt+Shift+S to open the popup.
• Get a warning if you've already saved a link. Tracking parameters like utm_ and fbclid are removed.

STAY ORGANISED
• Smart categories: YouTube goes to Watch, Amazon to Shopping, Google Docs and PDFs to Docs, GitHub to Work, articles to Read.
• Create your own categories, pin important links, mark them done, and search everything instantly.
• Works offline in the web app, with light and dark themes.

PRIVATE BY DESIGN
• Only pages you explicitly save are stored. No browsing history, no analytics, no ads.
• The extension reads the current tab's address and title only when you click it, use the menu or press the shortcut.
• Open source (MIT): https://github.com/lakshmanrevanth/check-later-extension

Your code works like a password: anyone who has it can see and edit your links, so keep it private.
```

**Category:** Productivity

**Language:** English

**Store icon:** `extension/icons/icon128.png`

**Official URL / homepage:** `https://checklater-ea1ba.web.app`

**Support URL:** `https://github.com/lakshmanrevanth/check-later-extension/issues`

### Screenshots

Upload at 1280×800 (or 640×400), PNG or JPEG. Regenerate them with `npm run screenshots`, which uses demo mode, so no real data appears.

Ready-made 1280×800 files in [`docs/screenshots/`](screenshots/):

1. `store-1-popup.png`: popup, right-click menu and sign-in states
2. `store-2-app.png`: the web app on desktop (light)
3. `store-3-app-dark.png`: the web app on desktop (dark)

The other files there (`mobile-*.png`, `desktop-*.png`, `hero.png`) are for the README and are not store-sized.

Optional promo tile: 440×280.

## Privacy practices tab

### Single purpose

```
CheckLater saves the current page, or a link, image or selected text the user chooses, to the user's CheckLater list so they can open it later on any of their devices.
```

### Permission justifications

**activeTab**

```
Used only when the user clicks the toolbar button, chooses "Send to CheckLater" in the right-click menu, or presses the quick-save shortcut. It lets the extension read the current tab's URL and title so that page can be saved. While the popup is open, that URL is also looked up in the user's own list to warn about duplicates. The extension never reads page content and has no access to tabs the user hasn't acted on.
```

**contextMenus**

```
Adds a "Send to CheckLater" right-click menu, with the user's categories, for pages, links, images, videos and selected text, so the user can save the item they right-clicked.
```

**storage**

```
Stores the user's CheckLater space code, display name, category list and the anonymous Firebase sign-in token locally in chrome.storage.local, so the user stays signed in and the menus show their categories. Nothing else is stored.
```

**Host permission: https://firestore.googleapis.com/***

```
Reads and writes the user's saved links in Google Cloud Firestore, CheckLater's database, through the Firestore REST API.
```

**Host permission: https://identitytoolkit.googleapis.com/***

```
Creates an anonymous Firebase Authentication user for this browser, required before Firestore accepts requests. No personal information is sent.
```

**Host permission: https://securetoken.googleapis.com/***

```
Refreshes the anonymous Firebase sign-in token when it expires (every hour), so saving keeps working.
```

### Remote code

**Are you using remote code?** No, I am not using remote code.

```
All JavaScript is included in the package. The extension only exchanges JSON data with Firebase REST APIs.
```

### Data usage

**What user data do you plan to collect from users now or in the future?** Tick these:

| Category | Tick? | What and why |
|---|---|---|
| Personally identifiable information | ✅ | The display name the user types when creating a space. It's shown in the app and isn't verified. |
| Health information | ❌ | |
| Financial and payment information | ❌ | |
| Authentication information | ✅ | The space code (works like a password) and the anonymous Firebase sign-in token, stored locally to keep the user signed in. |
| Personal communications | ❌ | |
| Location | ❌ | |
| Web history | ✅ | The URL and title of pages the user **explicitly saves**. No other browsing history is collected. |
| User activity | ❌ | |
| Website content | ✅ | Text the user selects and saves via the right-click menu (stored as the note), and page titles of saved pages. |

These declarations are conservative: the data is collected only when the user takes an action to save something.

**Certifications** (tick all three):

- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://checklater-ea1ba.web.app/privacy
```

(For your own deployment: `https://<project-id>.web.app/privacy`.)

## Distribution

- **Visibility:** Public (or Unlisted while testing)
- **Regions:** All regions
- **Pricing:** Free

## Reviewer notes (optional "test instructions" field)

```
No login credentials are needed. Click the toolbar icon → "New here", enter any name, click "Create my code" and "I saved it. Continue", then click "Save to CheckLater". Open https://checklater-ea1ba.web.app and enter the same code to see saved links.
```
