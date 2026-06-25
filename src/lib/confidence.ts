// Macro confidence model — turns a confidence label into a quantified error band.
//
//   High   — packaged / branded foods          ±5%
//   Medium — weighed home-cooked foods          ±15%
//   Low    — restaurant / ambiguous portions    ±30–50%

import type { Confidence } from './types'

export interface ErrorBand {
  /** Representative ± percentage used for computing a numeric range. */
  pct: number
  /** Human label for display. */
  label: string
  /** What this tier typically represents. */
  source: string
}

export function errorBand(c: Confidence): ErrorBand {
  switch (c) {
    case 'high':
      return { pct: 5, label: '±5%', source: 'packaged / branded' }
    case 'medium':
      return { pct: 15, label: '±15%', source: 'weighed home-cooked' }
    case 'low':
      return { pct: 40, label: '±30–50%', source: 'restaurant / ambiguous' }
  }
}

/** Apply the error band to a value, returning a [low, high] range. */
export function applyBand(value: number, c: Confidence): [number, number] {
  const p = errorBand(c).pct / 100
  return [Math.round(value * (1 - p)), Math.round(value * (1 + p))]
}
