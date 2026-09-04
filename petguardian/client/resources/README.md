# App icon & splash source assets

Starter assets for the PetGuardian iOS app. These are the master files that
`@capacitor/assets` uses to generate every required icon and splash size.

| File | Size | Use |
|---|---|---|
| `icon.png` | 1024×1024 (opaque) | App icon master. Also the App Store 1024 icon. |
| `icon.svg` | vector | Editable source for the icon. |
| `splash.png` | 2732×2732 | Launch screen (light mode). |
| `splash-dark.png` | 2732×2732 | Launch screen (dark mode). |

## Generate all sizes (on the Mac, after `npm run ios:add`)

```bash
cd petguardian/client
npx @capacitor/assets generate --ios
```

This reads `resources/icon.png`, `resources/splash.png`, and
`resources/splash-dark.png` and writes the full icon set and launch-screen
images into the native `ios/` project. Re-run it whenever you change the source
files, then `npm run ios:sync`.

## Notes

- The App Store icon must be **opaque** (no transparency) and square; Apple
  applies the rounded-corner mask. `icon.png` is already flattened.
- To regenerate from the vector source, edit `icon.svg` (or the generator at
  `build_assets.js` used to create these) and re-render at 1024.
- Brand: navy `#1e2a44` / blue `#2f49b8` / accent `#3b5bdb`, white paw.
