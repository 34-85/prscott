// Canonical health disclaimer + first-run acknowledgment persistence.

/** Bump when the wording materially changes to re-prompt everyone. */
export const DISCLAIMER_VERSION = 1

const ACK_KEY = 'psmf-disclaimer-accepted'

/** One-line summary used for footers and teasers. */
export const DISCLAIMER_SUMMARY =
  'This app estimates nutrition and weight trends — it is not medical advice.'

/** Full disclaimer, split into paragraphs for readable rendering. */
export const DISCLAIMER_PARAGRAPHS: string[] = [
  'This app estimates nutrition and weight trends. It is not medical advice.',
  'Very-low-calorie and PSMF-style diets should be undertaken carefully — especially if you have any medical condition or take any medication.',
  'Any diet should be followed only under the advice of a medical professional. Use this app solely in conjunction with — and as a communication tool with — your primary care physician or another qualified medical professional.',
]

/** True once the current disclaimer version has been acknowledged. */
export function hasAcceptedDisclaimer(): boolean {
  try {
    return localStorage.getItem(ACK_KEY) === String(DISCLAIMER_VERSION)
  } catch {
    // If storage is unavailable, fail safe by showing the disclaimer.
    return false
  }
}

/** Record acknowledgment of the current disclaimer version. */
export function acceptDisclaimer(): void {
  try {
    localStorage.setItem(ACK_KEY, String(DISCLAIMER_VERSION))
  } catch {
    /* best effort */
  }
}

/** Clear acknowledgment so the first-run gate shows again (e.g. on full reset). */
export function resetDisclaimer(): void {
  try {
    localStorage.removeItem(ACK_KEY)
  } catch {
    /* best effort */
  }
}
