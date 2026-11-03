## What does this change?

<!-- One or two sentences. Link the issue it fixes: "Fixes #123". -->

## Which parts are affected?

- [ ] Web app (`web/`)
- [ ] Chrome extension (`extension/`)
- [ ] Shared logic (`shared/`)
- [ ] Firestore rules (`firestore.rules`)
- [ ] Build, scripts or CI
- [ ] Docs

## Checklist

- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Tested by hand (web app via `npm run dev`, extension loaded unpacked after `npm run sync`)
- [ ] Screenshots attached for UI changes (light and dark)
- [ ] `CHANGELOG.md` updated under **Unreleased** for user-visible changes
- [ ] If `firestore.rules` changed: existing clients still work, and the change is explained below
- [ ] No secrets, `.env` or generated files (`shared/config.js`, `extension/lib/shared/`) committed

## Notes for the reviewer

<!-- Anything tricky, trade-offs, follow-ups. -->
