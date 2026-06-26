// Chat-mode intent classifier.
// Turns a free-text line into one of: weight | meal | correction | note.

import type { Confidence, FoodEntry } from './types'
import { estimateMeal } from './macroEstimator'
import { KNOWN_UNITS } from './parser'

export type ChatIntentType = 'weight' | 'meal' | 'correction' | 'note' | 'delete'

export interface ChatIntent {
  type: ChatIntentType
  raw: string
  /** weight / correction(weight) payload */
  weight?: number
  weightNote?: string
  /** meal / correction(meal) payload — text to feed the macro estimator */
  mealText?: string
  /** note payload */
  note?: string
  /** delete payload — natural-language reference to the meal to remove */
  mealRef?: string
  /** for corrections, what is being corrected */
  correctionTarget?: 'weight' | 'meal'
  confidence: Confidence
}

const CORRECTION_RE =
  /^(corrections?|correct|actually|oops|edit|fix|scratch that|i meant|make that|change that)\b[:,\-—]?\s*/i

const DELETE_RE = /^(delete|remove|undo|erase|get rid of|take off)\b[:,\-—]?\s*/i

// Trailing "… not 8" / "… not the 8 oz" clause in a correction — drop it.
const NOT_CLAUSE_RE = /[,;]?\s*\bnot\b\s+.*$/i

// Leading conversational filler to strip from a correction's remainder.
const FILLER_PREFIX_RE =
  /^(that was|it was|that's|thats|it's|its|i had|i ate|i meant|make it|should be|was|its actually)\s+/i

const NOTE_RE =
  /^(note|fyi|feeling|felt|mood|energy|slept|sleep|sodium|water|bloated|tired|stressed|sick|cramps)\b[:,\-—]?\s*/i

const WEIGHT_FILLER = new Set([
  'this', 'that', 'morning', 'today', 'tonight', 'am', 'pm', 'weighed', 'weigh', 'weight',
  'lbs', 'lb', 'pounds', 'pound', 'kg', 'kgs', 'scale', 'on', 'the', 'was', 'im', "i'm",
  'my', 'at', 'flat', 'even', 'about', 'around', 'roughly', 'approx', 'approximately', 'now',
])

const WEIGHT_MIN = 50
const WEIGHT_MAX = 600

/** Find a plausible body-weight number and the text left after removing it. */
export function extractWeight(text: string): { weight: number; index: number; leftover: string } | null {
  const m = text.match(/\b(\d{2,3}(?:\.\d{1,2})?)\b/)
  if (!m || m.index == null) return null
  const w = parseFloat(m[1])
  if (w < WEIGHT_MIN || w > WEIGHT_MAX) return null
  const leftover = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[1].length))
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .trim()
  return { weight: w, index: m.index, leftover }
}

/** Non-filler words remaining after the weight is removed (become a weight note). */
function weightExtra(leftover: string): string {
  return leftover
    .split(/\s+/)
    .filter((t) => t && !WEIGHT_FILLER.has(t))
    .join(' ')
}

/** True when the number is at the start (only filler/units before it). */
function startsWithWeight(text: string, index: number): boolean {
  const before = text.slice(0, index).toLowerCase().replace(/[^a-z'\s]/g, ' ').trim()
  if (!before) return true
  return before.split(/\s+/).every((t) => WEIGHT_FILLER.has(t))
}

function hasUnitOrQuantity(text: string): boolean {
  const tokens = text.toLowerCase().split(/\s+/)
  if (/^\d/.test(text.trim())) return true
  return tokens.some((t) => KNOWN_UNITS.includes(t))
}

function mealHasMatch(text: string, customFoods: FoodEntry[]): boolean {
  if (!text.trim()) return false
  return estimateMeal(text, customFoods).parsedFoods.some((f) => f.matched)
}

/** Classify a chat line into a routed intent. */
export function classifyChat(text: string, customFoods: FoodEntry[] = []): ChatIntent {
  const raw = text.trim()
  if (!raw) return { type: 'note', raw, note: '', confidence: 'low' }

  // 1. Delete — "delete lunch", "remove the chicken", "undo last meal".
  if (DELETE_RE.test(raw)) {
    const ref = raw.replace(DELETE_RE, '').trim()
    return { type: 'delete', mealRef: ref, raw, confidence: ref ? 'high' : 'low' }
  }

  // 2. Correction — strip the trigger, then sub-classify the remainder.
  if (CORRECTION_RE.test(raw)) {
    let remainder = raw.replace(CORRECTION_RE, '').trim()
    remainder = remainder.replace(FILLER_PREFIX_RE, '').trim()
    // "10 oz chicken not 8" -> "10 oz chicken"
    remainder = remainder.replace(NOT_CLAUSE_RE, '').trim()
    const we = extractWeight(remainder)
    if (we && startsWithWeight(remainder, we.index) && !mealHasMatch(remainder, customFoods)) {
      return {
        type: 'correction',
        correctionTarget: 'weight',
        weight: we.weight,
        weightNote: weightExtra(we.leftover) || undefined,
        raw,
        confidence: 'high',
      }
    }
    return {
      type: 'correction',
      correctionTarget: 'meal',
      mealText: remainder || raw,
      raw,
      confidence: remainder ? 'high' : 'low',
    }
  }

  // 3. Explicit "note: ..." prefix.
  if (/^note\b/i.test(raw)) {
    const note = raw.replace(/^note\b[:,\-—]?\s*/i, '').trim()
    return { type: 'note', note: note || raw, raw, confidence: 'high' }
  }

  // 4. Weight — a body-weight number leading the line, no food match.
  const we = extractWeight(raw)
  const hasFood = mealHasMatch(raw, customFoods)
  if (we && startsWithWeight(raw, we.index) && !hasFood) {
    const extra = weightExtra(we.leftover)
    return {
      type: 'weight',
      weight: we.weight,
      weightNote: extra || undefined,
      raw,
      confidence: extra ? 'medium' : 'high',
    }
  }

  // 5. Meal — a known food matched.
  if (hasFood) {
    return { type: 'meal', mealText: raw, raw, confidence: estimateMeal(raw, customFoods).confidence }
  }

  // 6. Note keywords (feeling / slept / sodium ...).
  if (NOTE_RE.test(raw)) {
    const note = raw.replace(NOTE_RE, '').trim()
    return { type: 'note', note: note || raw, raw, confidence: 'medium' }
  }

  // 7. Fallback — unit/quantity present reads as a meal guess; otherwise a note.
  if (hasUnitOrQuantity(raw)) {
    return { type: 'meal', mealText: raw, raw, confidence: 'low' }
  }
  return { type: 'note', note: raw, raw, confidence: 'low' }
}

export const INTENT_META: Record<ChatIntentType, { label: string; color: string }> = {
  weight: { label: 'Weight', color: 'text-accent' },
  meal: { label: 'Meal', color: 'text-good' },
  correction: { label: 'Correction', color: 'text-warn' },
  note: { label: 'Note', color: 'text-mute' },
  delete: { label: 'Delete', color: 'text-bad' },
}
