# App icons & splash

`icon.svg` is the source mark for the iOS app icon.

Capacitor's asset generator rasterizes a **1024×1024 PNG**, so on your Mac:

1. Export `icon.svg` to `resources/icon-only.png` at 1024×1024 (any tool: Preview,
   Figma, or `rsvg-convert -w 1024 -h 1024 icon.svg > icon-only.png`).
2. (Optional) Add `resources/splash.png` (2732×2732, artwork centered) and
   `resources/splash-dark.png` for a custom launch screen. If omitted, the solid
   background colour from `capacitor.config.ts` is used.
3. Generate every required size into the iOS project:

   ```bash
   npm i -D @capacitor/assets
   npx capacitor-assets generate --ios
   ```

This writes the full icon set and launch images into `ios/App/App/Assets.xcassets`.
Re-run it whenever the artwork changes.
