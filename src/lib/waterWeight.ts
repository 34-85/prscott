// Water-weight model — estimates how much of a scale move is temporary water
// rather than fat, from context signals. Expected range ~1–7 lb.

import type { DailyLog, UserSettings } from './types'

export interface WaterFactor {
  name: string
  min: number // lb
  max: number // lb
  detail: string
}

export interface WaterEstimate {
  /** Total estimated temporary water range, lb. */
  min: number
  max: number
  factors: WaterFactor[]
  /** True when at least one context factor (beyond baseline noise) was detected. */
  detected: boolean
}

interface FactorRule {
  name: string
  keys: RegExp
  min: number
  max: number
  detail: string
}

// Context cues scanned in the day's text (notes, weight note, meal text/notes).
const TEXT_FACTORS: FactorRule[] = [
  {
    name: 'High sodium',
    keys: /\b(sodium|salt|salty|soy|takeout|take-?out|restaurant|chinese|pizza|processed|deli|cured|bacon|broth|ramen|fast food)\b/i,
    min: 0.5,
    max: 2.5,
    detail: 'Sodium pulls water into tissue for 1–2 days.',
  },
  {
    name: 'Alcohol',
    keys: /\b(alcohol|wine|beer|cocktail|drinks|tequila|whiskey|vodka|margarita|hungover|hangover)\b/i,
    min: 0.3,
    max: 1.5,
    detail: 'Alcohol disrupts hydration and glycogen.',
  },
  {
    name: 'Poor sleep',
    keys: /\b(poor sleep|bad sleep|slept|no sleep|insomnia|tired|exhausted|restless|4 ?hrs|5 ?hrs|up all night)\b/i,
    min: 0.2,
    max: 1.2,
    detail: 'Short sleep raises cortisol and water retention.',
  },
  {
    name: 'Inflammation',
    keys: /\b(sore|doms|workout|lifted|leg day|trained|inflammation|injury|injured|sick|cold|flu|achy)\b/i,
    min: 0.3,
    max: 1.5,
    detail: 'Training/illness retains water for repair.',
  },
  {
    name: 'Bowel irregularity',
    keys: /\b(constipat|bloated|bloating|no bm|haven'?t gone|backed up|irregular|bathroom)\b/i,
    min: 0.5,
    max: 2.0,
    detail: 'Digestive contents and bloat add scale weight.',
  },
]

/** Average carbs across the most recent prior logged days (excludes the target day). */
function trailingCarbAvg(logs: Record<string, DailyLog>, date: string, n = 7): number | null {
  const prior = Object.values(logs)
    .filter((l) => l.date < date && l.meals.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
  if (prior.length === 0) return null
  return prior.reduce((a, l) => a + l.totalCarbs, 0) / prior.length
}

export function estimateWaterWeight(
  date: string,
  logs: Record<string, DailyLog>,
  _settings: UserSettings,
): WaterEstimate {
  const log = logs[date]
  const factors: WaterFactor[] = []

  // Baseline daily fluctuation always present (hydration, food in transit).
  factors.push({
    name: 'Normal daily variance',
    min: 0.5,
    max: 2.0,
    detail: 'Routine hydration and gut-content swings.',
  })

  if (log) {
    const haystack = [
      log.weightNote ?? '',
      ...(log.notes ?? []).map((n) => n.text),
      ...log.meals.map((m) => `${m.rawText} ${m.notes ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()

    for (const rule of TEXT_FACTORS) {
      if (rule.keys.test(haystack)) {
        factors.push({ name: rule.name, min: rule.min, max: rule.max, detail: rule.detail })
      }
    }

    // Restaurant meals imply hidden sodium even without an explicit cue.
    if (!factors.some((f) => f.name === 'High sodium') && log.meals.some((m) => m.restaurant)) {
      factors.push({
        name: 'High sodium',
        min: 0.5,
        max: 2.0,
        detail: 'Restaurant food is typically high in sodium.',
      })
    }

    // Carb surge vs. recent baseline → glycogen water (~3 g water per g glycogen).
    const baseline = trailingCarbAvg(logs, date)
    if (baseline != null && log.totalCarbs > baseline + 40) {
      const excess = log.totalCarbs - baseline
      const lb = Math.min(3, excess / 100) // ~1 lb water per ~100g extra carbs, capped
      factors.push({
        name: 'Carb increase',
        min: Math.round(lb * 0.5 * 10) / 10,
        max: Math.round(lb * 10) / 10,
        detail: `+${Math.round(excess)}g carbs vs. recent average refills glycogen + water.`,
      })
    }
  }

  let min = factors.reduce((a, f) => a + f.min, 0)
  let max = factors.reduce((a, f) => a + f.max, 0)
  // Clamp to the model's expected envelope.
  min = Math.round(Math.min(min, 6) * 10) / 10
  max = Math.round(Math.min(max, 7) * 10) / 10

  return {
    min,
    max,
    factors,
    detected: factors.length > 1,
  }
}
