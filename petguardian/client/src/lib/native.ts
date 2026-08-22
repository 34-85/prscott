/**
 * Native (Capacitor) integration. Every function is a safe no-op on the web
 * build, so the same React code runs in the browser and inside the iOS app.
 */
import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Stable positive 31-bit id from a plan id, for notification identity. */
function notifId(planId: string): number {
  let h = 0;
  for (let i = 0; i < planId.length; i++) h = (Math.imul(31, h) + planId.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647;
}

/** Called once on app start: sync the native status bar to the brand color. */
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1e2a44' });
    }
  } catch {
    /* status bar not available */
  }
}

export interface ReminderResult {
  ok: boolean;
  reason?: 'web' | 'denied' | 'error';
}

/**
 * Schedule (or reschedule) an annual "review your pet-care plan" reminder for a
 * plan, one year out. Native only; returns {ok:false, reason:'web'} in a browser.
 */
export async function scheduleAnnualReview(planId: string, planName: string): Promise<ReminderResult> {
  if (!isNative()) return { ok: false, reason: 'web' };
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return { ok: false, reason: 'denied' };

    const id = notifId(planId);
    const when = new Date();
    when.setFullYear(when.getFullYear() + 1);

    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Time to review your pet-care plan',
          body: `A year has passed. Review "${planName}" — caregivers, funding, and vet details can change.`,
          schedule: { at: when, allowWhileIdle: true },
        },
      ],
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function cancelAnnualReview(planId: string): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: notifId(planId) }] });
  } catch {
    /* ignore */
  }
}

/** Native share sheet for a URL/text (bonus; no-op on web where the browser handles it). */
export async function shareText(title: string, text: string, url?: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
}
