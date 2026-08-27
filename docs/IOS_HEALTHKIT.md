# Apple Health (HealthKit) — read morning weight

Goal: let the app read the user's **latest body weight** from Apple Health so
the morning weigh-in can pre-fill, instead of typing it. This is a **native**
capability — it needs a Capacitor plugin, an Xcode entitlement, and an on-device
permission prompt, so it can't be finished or tested from the web repo alone.
This guide is the exact recipe.

`src/lib/native.ts` already exposes the integration point:
`readLatestHealthWeightLb()` (returns `null` until wired). Everything below turns
that into a working read.

---

## 1. Pick a plugin (the Capacitor-6 situation)

There is no perfectly drop-in HealthKit plugin for Capacitor 6 today:

- **`@perfood/capacitor-healthkit`** — simple, read-focused, but its `package.json`
  pins `@capacitor/core@^4`. The JS bridge (`registerPlugin`) is stable across
  Capacitor 4→6, so it generally works, but you install it past the peer check
  and should confirm the iOS pod compiles under Capacitor 6.
  **Recommended to try first — smallest change.**
- **`capacitor-health`** — actively maintained (HealthKit **and** Android Health
  Connect) but requires `@capacitor/core@>=7`. Best if/when you bump Capacitor to
  7 (do it alongside Android in a later phase).
- **A tiny custom plugin** (~40 lines of Swift) — most control, no third-party
  dependency. Best long-term if the above are fussy.

The rest of this guide uses **`@perfood/capacitor-healthkit`** (Path A).

```bash
# in ~/psmf-app — the --legacy-peer-deps accepts the Cap-4 peer pin
npm install @perfood/capacitor-healthkit --legacy-peer-deps
npm run ios:sync
```

> If a later `npm install`/CI complains about peers, add an `.npmrc` with
> `legacy-peer-deps=true`, or a `package.json` `overrides` entry pinning
> `@capacitor/core`. Keep the web build green — the plugin's web layer just
> throws "not available", which our `isNative()` guard already avoids.

---

## 2. Xcode: capability + usage strings (required)

HealthKit will not work — and the App Store will reject the build — without
these. In Xcode, with the **App** target selected:

1. **Signing & Capabilities → + Capability → HealthKit.** (Leave "Clinical
   Records" off; we only need body mass.)
2. **Info tab → add usage descriptions** (these strings are shown in the
   permission prompt, so write them for the user):
   - `Privacy - Health Share Usage Description`
     (`NSHealthShareUsageDescription`) —
     *"PSMF Tracker reads your latest body weight so your morning weigh-in can
     fill in automatically. Your health data stays on your device and is never
     sold or used for ads."*
   - Only if you later **write** weight back, also add
     `Privacy - Health Update Usage Description`
     (`NSHealthUpdateUsageDescription`).

Then `npm run ios:sync` again so the config is in the project.

---

## 3. Wire `src/lib/native.ts`

Replace the `readLatestHealthWeightLb` stub with the implementation below and add
the authorization helper. Both stay guarded by `isNative()` and wrapped in
try/catch, so the web build is unaffected.

```ts
/** Ask the user to grant read access to body weight. Safe no-op on web. */
export async function requestHealthAuthorization(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { CapacitorHealthkit } = await import('@perfood/capacitor-healthkit')
    await CapacitorHealthkit.requestAuthorization({
      all: [],
      read: ['weight'],
      write: [],
    })
    return true
  } catch {
    return false
  }
}

/** Latest Apple Health body weight in pounds, or null. */
export async function readLatestHealthWeightLb(): Promise<number | null> {
  if (!isNative()) return null
  try {
    const { CapacitorHealthkit } = await import('@perfood/capacitor-healthkit')
    const end = new Date()
    const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 365) // last year
    const res: any = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'weight',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 0, // all in range; we pick the newest ourselves
    })
    const samples: any[] = res?.resultData ?? []
    if (!samples.length) return null
    const latest = samples.reduce((a, b) =>
      new Date(b.endDate ?? b.startDate) > new Date(a.endDate ?? a.startDate) ? b : a,
    )
    const v = Number(latest.value)
    if (!isFinite(v) || v <= 0) return null
    // HealthKit stores body mass in kg; convert unless the sample says pounds.
    const unit = String(latest.unitName ?? '').toLowerCase()
    const lb = unit.includes('lb') || unit.includes('pound') ? v : v * 2.20462
    return Math.round(lb * 10) / 10
  } catch {
    return null
  }
}
```

> Verify the field names (`resultData`, `value`, `unitName`, `startDate`/
> `endDate`) and the weight unit against what the installed plugin actually
> returns — log one sample the first time. The code above is defensive about
> both, but plugins differ.

---

## 4. Add the "Import from Apple Health" button

In `src/components/WeightEntry.tsx`, inside the editing view, show a native-only
button that fills the field:

```tsx
import { isNative, requestHealthAuthorization, readLatestHealthWeightLb } from '../lib/native'

// …inside the component, in the edit state:
{isNative() && (
  <button
    type="button"
    onClick={async () => {
      await requestHealthAuthorization()
      const w = await readLatestHealthWeightLb()
      if (w != null) setVal(String(w))
    }}
    className="btn-ghost text-[12px] text-accent"
  >
    Import from Apple Health
  </button>
)}
```

Optionally add a Settings row that calls `requestHealthAuthorization()` once so
the prompt appears during onboarding rather than at first weigh-in.

---

## 5. Test on device

1. `npm run ios:sync` → Xcode **▶ Run** onto your iPhone.
2. Open a weigh-in → tap **Import from Apple Health** → grant permission in the
   system sheet → the latest weight fills in.
3. Toggle it off in **iOS Settings → Privacy & Security → Health → PSMF Tracker**
   to confirm it degrades gracefully (button just does nothing).

---

## Privacy

Reading Health data is already covered by the app's privacy policy: health data
is used only in-app to show trends, is **never** used for advertising, and is
**never** sold or shared. HealthKit's own rules require this — don't add any
analytics/ads path that touches Health data.
