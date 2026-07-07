# PSMF Tracker → iPhone App (Capacitor + App Store)

This document is the roadmap for shipping the existing web app to the App Store
using **Capacitor**, which wraps the current codebase in a native iOS project —
no rewrite. The repo has already been prepared for this (see "Already done").

---

## Already done in this repo

- **Capacitor installed**: `@capacitor/core`, `cli`, `ios`, plus `app`,
  `status-bar`, `keyboard`, `splash-screen`, `local-notifications`,
  `preferences`.
- **`capacitor.config.ts`** — app id `com.prscott.psmftracker`, name
  "PSMF Tracker", `webDir: dist`, splash + keyboard config.
- **Build scripts** in `package.json`:
  - `npm run ios:build` – builds the web app with base `/` (Capacitor serves
    from the app root; the Pages build still uses `/prscott/`).
  - `npm run ios:add` – first-time: build + create the native `ios/` project.
  - `npm run ios:sync` – rebuild web + copy into the iOS project.
  - `npm run ios:open` – open the project in Xcode.
- **`src/lib/native.ts`** — all native calls, each a no-op on web:
  status-bar/theme sync, splash hide, local-reminder helpers, a durable
  storage backup, and an Apple Health stub.
- **Durable storage** — state is mirrored into native Preferences and restored
  on launch, so iOS can't lose your logs by evicting the WebView's localStorage.
- **Native-feel CSS** — safe-area (notch) padding, no rubber-band overscroll,
  no tap highlight.
- **App icon source** — `resources/icon.svg` + `resources/README.md`.

Everything above is inert on the web build (verified), so the live site is
unaffected.

---

## What you need

| Requirement | Notes |
|---|---|
| A Mac | Xcode is macOS-only. ✅ you have this |
| Xcode | Free from the Mac App Store |
| Apple Developer Program | $99/year. ✅ you have an account |
| CocoaPods | `sudo gem install cocoapods` (Capacitor uses it for iOS deps) |

---

## First build (on your Mac)

```bash
git clone https://github.com/34-85/prscott.git
cd prscott
npm install

# Create the native iOS project (one time)
npm run ios:add

# Open it in Xcode
npm run ios:open
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities** → check **Automatically
   manage signing** and pick your **Team** (your developer account).
2. Plug in your iPhone, select it as the run destination, press **▶ Run**.
   The app installs and launches on your phone.

After any change to the web app, re-sync:
```bash
npm run ios:sync
```

### App icon
```bash
# export resources/icon.svg → resources/icon-only.png (1024×1024), then:
npm i -D @capacitor/assets
npx capacitor-assets generate --ios
```

---

## Native features

### 1. Status bar + splash — done
Handled in `native.ts` / `capacitor.config.ts`. Status-bar text color follows
the light/dark theme automatically.

### 2. Local reminders — wiring ready
`native.ts` exposes `requestNotificationPermission()`,
`scheduleDailyReminder(id, title, body, hour, minute)`, and `cancelReminder(id)`.
To use: add a "Reminders" toggle in Settings that requests permission and
schedules e.g. a 7am weigh-in nudge. No Info.plist changes needed for local
notifications.

### 3. Apple Health (the high-value feature)
Auto-fill the morning weigh-in from Health (or a smart scale that writes to it).

1. Add a plugin, e.g. **`@perfood/capacitor-healthkit`**:
   ```bash
   npm i @perfood/capacitor-healthkit && npm run ios:sync
   ```
2. In Xcode → target → **Signing & Capabilities → + Capability → HealthKit**.
3. In `ios/App/App/Info.plist` add usage strings:
   ```xml
   <key>NSHealthShareUsageDescription</key>
   <string>Reads your body weight to pre-fill your morning weigh-in.</string>
   <key>NSHealthUpdateUsageDescription</key>
   <string>Optionally writes your logged weight back to Health.</string>
   ```
4. Implement the body of `readLatestHealthWeightLb()` in `native.ts` using the
   plugin's `queryHKitSampleType` for `HKQuantityTypeIdentifierBodyMass`, convert
   kg→lb, and call it from `WeightEntry` to prefill the field.

### 4. Durable storage — done
State is backed up to native Preferences on every save and restored on launch.

### Optional later
- Face ID lock (`@capacitor-community/biometric-auth`) — it's personal health data.
- Home-screen widget (native Swift; more involved).

---

## App Store submission

1. **App Store Connect** (appstoreconnect.apple.com) → create the app record
   (bundle id `com.prscott.psmftracker`).
2. In Xcode: **Product → Archive** → **Distribute App → App Store Connect**.
3. **TestFlight** — install on your own phone (and invite testers) to shake it
   out before public release.
4. Fill in the listing: name, description, keywords, **screenshots** (from the
   iOS Simulator), support URL, and the **App Privacy** questionnaire.
5. Submit for review (typically 1–3 days).

### Review guidance for a PSMF / weight-loss app
Apple scrutinizes weight-loss apps (guideline 1.4.1) and rejects "just a website"
wrappers (4.2). To pass cleanly:
- **Add real native value** — the Health sync + local reminders above satisfy 4.2.
- **Frame it as a personal tracking tool**, not medical advice. Keep the existing
  disclaimer prominent.
- **Avoid medical/outcome claims** and any language *encouraging* dangerously low
  intake. The PSMF day targets are the user's own configuration, presented
  neutrally with the disclaimer.
- **App Privacy**: data is stored on-device only (no account, no tracking) — the
  simplest, most privacy-friendly answer set.

---

## Data on multiple devices (future)
Today, data lives on one device (localStorage + native backup). To sync across
iPhone/iPad or provide cloud backup you'd add either:
- **iCloud key-value / CloudKit** (native, Apple-only, no server), or
- **A small backend + account login** (works cross-platform, more work).
This is independent of everything above and can wait.

---

## Cost & time summary
- **Cost**: $99/year (Apple Developer) — nothing else required.
- **Time**: with the repo already prepped, a focused weekend — most of it is
  Apple account setup, the Health integration, and App Review, not coding.

## Command cheat-sheet
```bash
npm run ios:add     # one time: create ios/ project
npm run ios:open    # open in Xcode
npm run ios:sync    # after web changes: rebuild + copy to iOS
```
