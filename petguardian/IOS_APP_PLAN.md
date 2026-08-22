# PetGuardian → iPhone App (Capacitor + App Store)

This is the roadmap for shipping the PetGuardian web app to the App Store using
**Capacitor**, which wraps the existing React client (`client/`) in a native iOS
project. The app bundles the UI on-device and calls the hosted API (Render) over
HTTPS. No rewrite.

## Already done in this repo

- **Capacitor installed** in `client/`: `@capacitor/core`, `cli`, `ios`, plus
  `local-notifications`, `share`, `status-bar`, `app`.
- **`client/capacitor.config.ts`** — app id `com.petguardian.app`, name
  "PetGuardian", `webDir: dist`.
- **Build scripts** in `client/package.json`: `ios:add`, `ios:sync`, `ios:open`.
- **Configurable API base** — `VITE_API_BASE_URL` (see `client/src/api/client.ts`).
  On web it is empty (same-origin). For iOS you set it to the Render URL so the
  bundled app reaches the server.
- **`client/src/lib/native.ts`** — native calls, each a no-op on web: status-bar
  style, an **annual plan-review local notification**, and a share helper.
- **In-app account deletion** — required for approval (see review notes). Backend
  `DELETE /api/auth/me` (password-confirmed, cascades all data) and the UI at
  **Account → Delete account**.
- **Public Privacy Policy** at `/privacy` (and `PRIVACY_POLICY.md`).

## Prerequisites (you provide)

- Apple Developer Program membership ($99/year).
- A Mac with Xcode. Required to archive and upload. (A cloud-Mac or Ionic
  Appflow / EAS Build can substitute for the build step.)
- App icon (1024×1024 PNG), screenshots (6.7" and 6.1" iPhone at minimum).
- The live API URL, e.g. `https://petguardian-XXXX.onrender.com`.

## First-time setup (on the Mac)

```bash
cd petguardian/client
# Point the app at the hosted API for the native build:
export VITE_API_BASE_URL=https://petguardian-XXXX.onrender.com
npm install
npm run ios:add      # builds web + creates the native ios/ project (runs pod install)
npm run ios:open     # opens ios/App/App.xcworkspace in Xcode
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities** → set your **Team** and a
   unique **Bundle Identifier** (`com.petguardian.app`).
2. Add the app icon in **Assets** and set a display name.
3. Add the **Push/Local Notifications** capability is not required for local
   notifications, but confirm the notifications permission string is present
   (see Info.plist note below).

## Every update after that

```bash
cd petguardian/client
export VITE_API_BASE_URL=https://petguardian-XXXX.onrender.com
npm run ios:sync     # rebuild web + copy into the iOS project
npm run ios:open     # archive from Xcode: Product → Archive → Distribute App
```

## Info.plist strings to add (Xcode → Info)

- `NSUserNotificationsUsageDescription` (or set via the notifications prompt) —
  e.g. "PetGuardian sends you a yearly reminder to review your pet-care plan."

## App Store Connect checklist

- Create the app record (bundle id `com.petguardian.app`).
- **Privacy Policy URL:** `https://<your-app-domain>/privacy`.
- **App Privacy "nutrition labels":** declare Contact Info (name, email),
  User Content (the plan details users enter), and Identifiers as used for app
  functionality. Not used for tracking. Not sold.
- Category: Lifestyle or Productivity. Age rating: 17+ is not required; complete
  the questionnaire honestly (no objectionable content).
- Screenshots + description + keywords + support URL.
- Submit for review.

## App Store review notes (the traps, and how this build handles them)

1. **Account deletion — Guideline 5.1.1(v).** Required. Done: Account → Delete
   account (in-app, password-confirmed, permanent, cascades all data).
2. **Minimum functionality — Guideline 4.2.** A bare webview gets rejected. This
   build adds native value: local-notification review reminders, native status
   bar, and the share sheet. Consider adding offline access to the emergency card
   before submitting for a stronger case.
3. **In-app purchase — Guideline 3.1.1.** If you sell the **premium digital tier**
   inside the app, Apple requires its In-App Purchase (15% small-business or 30%).
   **Affiliate/insurance/attorney referrals are real-world services** and are
   outside IAP; they may link out (review the current external-link rules first).
   Decide the premium mechanism before enabling paid features in the app.
4. **Sign in with Apple — Guideline 4.8.** Only required if you add a third-party
   social login (Google, Facebook). Email/password alone does not trigger it.
5. **Privacy & sensitive data.** Estate/caregiver data is sensitive. Keep HTTPS,
   accurate labels, the "not legal advice / a guide for your attorney" framing,
   and never sell personal data.

## Known follow-ups (nice-to-have before or shortly after launch)

- Native PDF handling: on iOS, route document downloads through the share sheet
  (`native.ts` has `shareText`; extend to share the generated PDF file) instead
  of a browser download.
- App icon and splash source assets (add under `client/resources/`).
- Replace the placeholder contact address in the Privacy Policy with a monitored
  inbox.
