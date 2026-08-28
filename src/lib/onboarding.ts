// First-run onboarding gate. Separate from the disclaimer flag because the
// disclaimer is one *step* inside onboarding.

import { hasAcceptedDisclaimer } from './disclaimer'

const ONBOARDED_KEY = 'psmf-onboarded'

/** True once the user has completed onboarding (or is a grandfathered user). */
export function hasOnboarded(): boolean {
  try {
    if (localStorage.getItem(ONBOARDED_KEY) === '1') return true
    // Grandfather anyone already using the app (they cleared the old disclaimer
    // gate) so the new flow only shows to genuinely new users.
    if (hasAcceptedDisclaimer()) {
      localStorage.setItem(ONBOARDED_KEY, '1')
      return true
    }
    return false
  } catch {
    return false
  }
}

export function setOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  } catch {
    /* best effort */
  }
}

/** Clear onboarding (e.g. on a full data reset) so the flow shows again. */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDED_KEY)
  } catch {
    /* best effort */
  }
}
