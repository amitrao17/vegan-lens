# Vegan Lens on Firefox (desktop and Android)

The Firefox package is built from the same source as the Chrome one. Only `manifest.json` changes:

```
node tools/build-firefox.js            # -> /workspace/vegan-lens-firefox-<version>.zip
```

## What differs from the Chrome build
| | Chrome | Firefox |
|---|---|---|
| Background | `service_worker: background.js` (loads helpers with `importScripts`) | `background.scripts`: the same helper files listed in order, then `background.js` (event page) |
| Add-on id | none | `browser_specific_settings.gecko.id = vegan-lens@veganlens.app` (**placeholder**: pick the final id before the first AMO upload and never change it afterwards) |
| Min version | — | Firefox 140 desktop, Firefox for Android 142 (the first versions that read `data_collection_permissions`) |
| Data collection | — | `required: ["none"]`; `optional: ["technicalAndInteraction"]` covers the opt-in anonymous stats. Review this against AMO's categories before you publish. |

## Features that work differently on Firefox for Android
All of these are feature-checked, so nothing errors when an API is missing.
- **Popup:** it opens as a full tab, not a little popup. The "This page" tab then uses the page you were on, which is the most recently used other tab.
- **Badge count on the icon:** Android shows the extension in the ⋮ menu → Extensions. The badge number may not appear there. Counts still show in the popup.
- **"Share with Vegan Lens" right-click menu:** Android has no context menus, so this isn't available. Sharing from the popup still works.
- **Opening the popup programmatically (`action.openPopup`):** not supported on Android. A pending share falls back quietly.
- **`tabs.onReplaced`:** may be missing on Android. It's only used for cleanup, and the code checks for it first.
- **Settings sync:** settings are saved, but Firefox for Android doesn't sync them between devices.

## Test on an Android phone
**Option A: Firefox Nightly custom collection (no cable needed, but the add-on must be on AMO, signed or unlisted).**
1. Install **Firefox Nightly** from the Play Store.
2. Open ⋮ → Settings → About Firefox Nightly, and tap the Firefox logo 5 times. This unlocks debug settings.
3. Settings → **Custom Add-on collection**. Enter your AMO user id and a collection name that contains Vegan Lens.
4. The app restarts. ⋮ → Add-ons → install Vegan Lens.

Note: Nightly can also install a signed `.xpi` file directly: ⋮ → Settings → "Install extension from file", after step 2.

**Option B: `web-ext run` over USB from the Windows PC (unsigned, for development).**
1. On the phone: Settings → About phone → tap **Build number** 7 times, then Developer options → **USB debugging** on.
2. In Firefox (or Nightly) on the phone: Settings → **Remote debugging via USB** on.
3. On the PC: install Node.js and Android platform-tools (adb). Run `adb devices` and accept the prompt on the phone. The phone should be listed.
4. Unzip the Firefox build into a folder, then in that folder run:
   `npx web-ext run -t firefox-android --adb-device <id from adb devices> --firefox-apk org.mozilla.fenix`
   Use `org.mozilla.firefox` for release Firefox, or `org.mozilla.fenix` for Nightly.
5. Firefox opens on the phone with Vegan Lens loaded temporarily. It disappears when Firefox closes.

## Load temporarily on desktop Firefox
1. Go to `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on…**.
2. Pick `manifest.json` inside the unzipped Firefox build, or the zip itself.
3. It stays until Firefox restarts. Use **Inspect** there to see the background console.

## Publish on addons.mozilla.org (AMO)
Publishing is free. Firefox only installs **signed** add-ons, and AMO does the signing.
1. Create a Firefox account and sign in at https://addons.mozilla.org/developers/.
2. Submit a New Add-on and choose **On this site** (listed) or **On your own** (unlisted: signed `.xpi` for self-distribution).
3. Upload `vegan-lens-firefox-<version>.zip`. Under compatibility, tick **Firefox** and **Firefox for Android**. Android must be ticked for the add-on to show up on phones.
4. Source code: the files aren't minified, so normally no separate source upload is needed. Say so in the reviewer notes.
5. Add the description, privacy policy (see CHROMEWEBSTORE.md), affiliate disclosure and screenshots. Then wait for review.
6. For each update, bump `version` in `manifest.json`, rebuild, and upload a new version. The gecko id must stay the same.

You can also sign without listing using `web-ext sign --channel=unlisted` with AMO API keys.
