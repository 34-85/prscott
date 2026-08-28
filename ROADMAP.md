# PSMF Tracker — Roadmap

A calm, private dashboard for a protein-sparing modified fast — on iPhone and the web.

---

## ✅ Shipped

**The app** (local-first, React + TypeScript + Vite, Tailwind)
- Plain-English meal logging with calorie/macro estimation; chat + structured modes
- Morning weigh-in, water tracking, day types (PSMF / Cut / Maintenance / Refeed / Travel) with per-type targets
- Compliance score, forecast to goal, coach insights, personal food library
- Editable history — add/edit meals, weight, water for **any** past or missed day
- Health & Safety disclaimer (first-run gate + Safety tab)
- Splash screen, app icon, light/dark themes

**iOS** (Capacitor wrapper)
- Paid Apple Developer account, signing, on-device install
- **TestFlight internal testing working** (build → Archive → upload → auto-added to internal group → accept invite → install)

**Accounts + cloud sync** (Phase 1 — Supabase)
- Email one-time-code sign-in (no passwords), via Resend SMTP
- Full-state snapshot sync in `profiles.state`, last-write-wins, re-pulls on tab focus → live across iPhone + web
- Row-level security; the BYO AI key never leaves the device

**Onboarding + guidance**
- Guided first run: welcome + name → disclaimer → required sign-in → goal setup → multi-screen "how it works" tour
- Always-available **Guide** tab; "Hello, {name}" greeting on Today; editable name in Settings

---

## 🎯 Next up (in dependency order)

The domain is the first domino — it anchors the web interface and the email sender.

1. **Register `psmftracker.com`** — the brandable anchor for everything below.
2. **Real web interface** — a proper landing/marketing site, and move the app onto a custom domain (e.g. `app.psmftracker.com`), likely on Vercel, off the GitHub Pages URL.
3. **Resend domain verification** — verify `psmftracker.com` in Resend so sign-in codes send from `noreply@psmftracker.com` to **anyone** (currently only `prscott@prscott.com` receives codes — Resend test mode). This unblocks non-owner sign-ups.
4. **External user feedback** — turn on TestFlight **external** testing (one-time Beta App Review per version) and set up a way to collect early-user feedback.

---

## 🔭 Later

- **Monetization** — start free to gather users/feedback, then introduce a paid tier (RevenueCat for iOS subscriptions).
- **Managed AI Coach** — move from bring-your-own-key to a managed coach when monetizing.
- **Apple Health (HealthKit)** — read morning weight to pre-fill the weigh-in (recipe in `docs/IOS_HEALTHKIT.md`; needs Mac-side native work).
- **Android** — Capacitor already supports it; bump to Capacitor 7 and add the Android target.
- **Barcode / food database** — scan packaged foods (e.g. OpenFoodFacts).
- **Privacy/legal review** of the disclaimer + privacy policy before a public launch.

---

## Reference

- Web app (current): https://34-85.github.io/prscott/
- Supabase schema: `docs/supabase-schema.sql`
- HealthKit wiring guide: `docs/IOS_HEALTHKIT.md`
- Privacy policy: `docs/PRIVACY.md` (served at `/prscott/privacy.html`)
