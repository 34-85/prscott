// Native (Capacitor) integration. Every call is guarded by isNativePlatform(),
// so on the web build these are no-ops and nothing changes.

import { Capacitor } from '@capacitor/core'
import type { Theme } from './theme'

export const isNative = (): boolean => Capacitor.isNativePlatform()

/** Match the iOS status-bar text color to the current theme. */
export async function syncNativeChrome(theme: Theme): Promise<void> {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Style.Dark = dark text (for light backgrounds); Style.Light = light text.
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Dark : Style.Light })
  } catch {
    /* status bar not available */
  }
}

/** One-time native setup: dismiss the splash, tune the keyboard, sync chrome. */
export async function initNative(theme: Theme): Promise<void> {
  if (!isNative()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* no splash */
  }
  await syncNativeChrome(theme)
}

// ---- Local reminders (opt-in) --------------------------------------------

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const res = await LocalNotifications.requestPermissions()
    return res.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Schedule a daily reminder at a given local time (e.g. a morning weigh-in nudge).
 * Safe no-op on web.
 */
export async function scheduleDailyReminder(
  id: number,
  title: string,
  body: string,
  hour: number,
  minute = 0,
): Promise<void> {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    })
  } catch {
    /* notifications not available */
  }
}

export async function cancelReminder(id: number): Promise<void> {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id }] })
  } catch {
    /* ignore */
  }
}

// ---- Durable storage backup ----------------------------------------------
//
// iOS can evict a WebView's localStorage under storage pressure. To keep the
// user's logs safe, we mirror the persisted state into native Preferences
// (which is not evicted) and restore it on launch if localStorage was cleared.

const BACKUP_KEY = 'psmf-state-backup'
const STATE_KEY = 'psmf-tracker-state'

/** Mirror the latest persisted state into native storage. No-op on web. */
export async function backupStateToNative(raw: string): Promise<void> {
  if (!isNative()) return
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: BACKUP_KEY, value: raw })
  } catch {
    /* ignore */
  }
}

/**
 * On native launch, if localStorage lost the state but a native backup exists,
 * restore it before the app reads state. Awaited during boot; no-op on web.
 */
export async function restoreFromNativeBackup(): Promise<boolean> {
  if (!isNative()) return false
  try {
    if (localStorage.getItem(STATE_KEY)) return false // localStorage intact
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: BACKUP_KEY })
    if (value) {
      localStorage.setItem(STATE_KEY, value)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

// ---- Apple Health (scaffold) ---------------------------------------------
//
// HealthKit needs a native plugin + entitlement that can only be built/tested
// on a Mac, so it is intentionally left as a typed stub here. See
// IOS_APP_PLAN.md → "Apple Health" for the exact plugin, Info.plist keys, and
// wiring. When ready, this function reads the latest body-mass sample so the
// morning weigh-in can be pre-filled automatically.
export async function readLatestHealthWeightLb(): Promise<number | null> {
  if (!isNative()) return null
  return null
}
