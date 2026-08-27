# App icons & launch images

Ready-to-use source assets for the iOS app icon and launch screen. These are
the exact sizes `@capacitor/assets` expects, so generating the full set is one
command on your Mac.

## Files

- `icon.png` — **1024×1024** app icon (descending weight-trend mark on a navy
  field). `icon.svg` is the editable source.
- `splash.png` — **2732×2732** launch image, light (PSMF Tracker logo centered
  on `#f4f6f9`).
- `splash-dark.png` — **2732×2732** launch image, dark (logo on `#0a0d12`).
- `logo.svg` — the full brand mark (source for the splash + the in-app splash).

## Generate the iOS icon set + launch images

On your Mac, in `~/psmf-app`:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --ios
npm run ios:sync
```

`capacitor-assets generate` reads `icon.png` / `splash.png` / `splash-dark.png`
from `resources/` and writes every required size into
`ios/App/App/Assets.xcassets` (app icon set + `Splash` image set). `ios:sync`
copies the web build in. Then in Xcode hit **▶ Run** to see the new icon on
your home screen and the native launch image.

Re-run the three commands whenever the artwork changes.

## Regenerating the source PNGs from the SVGs

The PNGs were rasterized from `icon.svg` and `logo.svg`. If you edit those,
re-export at the sizes above (any tool — Preview, Figma, or
`rsvg-convert -w 1024 -h 1024 icon.svg > icon.png`). Keep the splash logo
centered with generous margins; `@capacitor/assets` centers it as-is.
