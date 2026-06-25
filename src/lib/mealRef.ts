// Resolve a natural-language meal reference ("lunch", "the chicken", "last meal")
// to a specific meal within a day.

import type { Meal } from './types'

const STOP = new Set([
  'the', 'my', 'a', 'an', 'meal', 'of', 'from', 'please', 'entry', 'today', 'i', 'had',
  'ate', 'that', 'this', 'one', 'and',
])

/** Latest meal whose logged time falls in [lo, hi) hours. */
function byTimeBucket(sorted: Meal[], lo: number, hi: number): Meal | null {
  const inBucket = sorted.filter((m) => {
    const h = new Date(m.timestamp).getHours()
    return h >= lo && h < hi
  })
  return inBucket.length ? inBucket[inBucket.length - 1] : null
}

/**
 * Best-effort resolution of a meal reference. Returns null when nothing matches
 * (the caller decides whether to fall back or warn).
 */
export function resolveMealRef(meals: Meal[], ref: string): Meal | null {
  if (meals.length === 0) return null
  const sorted = [...meals].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const mostRecent = sorted[sorted.length - 1]
  const r = ref.toLowerCase().trim()
  if (!r) return mostRecent

  if (/\b(last|latest|recent|previous|prior|just now)\b/.test(r)) return mostRecent
  if (/\b(first|earliest)\b/.test(r)) return sorted[0]
  if (/\b(breakfast|morning)\b/.test(r)) return byTimeBucket(sorted, 4, 11)
  if (/\b(lunch|midday|noon)\b/.test(r)) return byTimeBucket(sorted, 11, 16)
  if (/\b(dinner|supper|evening|tonight)\b/.test(r)) return byTimeBucket(sorted, 16, 24)
  if (/\bsnack\b/.test(r)) return mostRecent

  // Food-name match: any meaningful token appearing in the meal's text/foods.
  const tokens = r.split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t))
  if (tokens.length) {
    const matches = sorted.filter((m) => {
      const hay = (m.rawText + ' ' + m.parsedFoods.map((f) => f.foodName).join(' ')).toLowerCase()
      return tokens.some((t) => hay.includes(t))
    })
    if (matches.length) return matches[matches.length - 1]
  }

  return null
}
