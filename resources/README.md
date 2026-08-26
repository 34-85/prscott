# App icons & splash

- `logo.svg` — the full PSMF Tracker brand mark (wordmark, macro rings, tagline).
  This is what the app shows as its **in-app splash** (an inline, theme-aware copy
  lives in `index.html`, painted before React mounts and faded out on boot), and
  it's the source for the native iOS **launch image**.
- `icon.svg` — the compact source mark for the iOS app **icon**.

Capacitor's asset generator rasterizes PNGs, so on your Mac:

1. Export `icon.svg` to `resources/icon-only.png` at **1024×1024** (any tool: Preview,
   Figma, or `rsvg-convert -w 1024 -h 1024 icon.svg > icon-only.png`).
2. For a branded native launch screen, export `logo.svg` centered onto a
   **2732×2732** canvas as `resources/splash.png` (light, `#f4f6f9` background) and
   `resources/splash-dark.png` (dark, `#0a0c10` background). If omitted, the solid
   background colour from `capacitor.config.ts` is used — the in-app splash still
   shows the logo either way.
3. Generate every required size into the iOS project:

   ```bash
   npm i -D @capacitor/assets
   npx capacitor-assets generate --ios
   ```

This writes the full icon set and launch images into `ios/App/App/Assets.xcassets`.
Re-run it whenever the artwork changes.
