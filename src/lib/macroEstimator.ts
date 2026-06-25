import type { Confidence, FoodEntry, FoodEstimate } from './types'
import { getFoodDatabase } from './foodDatabase'
import { parseMeal, type ParsedSegment } from './parser'

export interface MealEstimate {
  parsedFoods: FoodEstimate[]
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: Confidence
}

/** Find the best food entry for a parsed food phrase. */
function matchFood(foodText: string, db: FoodEntry[]): { entry: FoodEntry; alias: string } | null {
  const text = foodText.toLowerCase().trim()
  if (!text) return null

  let best: { entry: FoodEntry; alias: string; score: number } | null = null

  for (const entry of db) {
    for (const alias of entry.aliases) {
      const a = alias.toLowerCase()
      let hit = false
      // Exact match is strongest; otherwise word-boundary containment either way.
      if (text === a) hit = true
      else if (text.includes(a) || a.includes(text)) hit = true

      if (!hit) continue

      // Score: longer alias = more specific; lower priority value = preferred source.
      const score = a.length * 100 - entry.priority - (text === a ? 1000 : 0)
      if (!best || score > best.score) {
        best = { entry, alias: a, score }
      }
    }
  }

  return best ? { entry: best.entry, alias: best.alias } : null
}

/** Round to one decimal for clean display. */
const r1 = (n: number) => Math.round(n * 10) / 10
const r0 = (n: number) => Math.round(n)

/** Resolve how many base units a parsed segment represents. */
function resolveMultiplier(
  seg: ParsedSegment,
  entry: FoodEntry,
): { multiplier: number; confidence: Confidence } {
  const { quantity, unit, raw } = seg
  const rawLower = raw.toLowerCase()
  const portions = entry.portionRules ?? {}

  // Meats: macros are per ounce; treat any bare number as ounces.
  if (entry.perOunce) {
    if (quantity != null) {
      if (!unit || unit === 'oz') return { multiplier: quantity, confidence: 'high' }
      if (unit === 'g') return { multiplier: quantity / 28.35, confidence: 'medium' }
      if (unit === 'serving') return { multiplier: quantity * (entry.defaultAmount ?? 4), confidence: 'medium' }
      // Unknown unit for a meat — assume ounces.
      return { multiplier: quantity, confidence: 'medium' }
    }
    // No quantity → default portion (still a guess).
    return { multiplier: entry.defaultAmount ?? 4, confidence: 'medium' }
  }

  // Non-meat foods with discrete base units (serving / scoop / bottle / cup ...).
  if (quantity != null) {
    if (unit) {
      if (unit === entry.unit) return { multiplier: quantity, confidence: 'high' }
      if (unit in portions) return { multiplier: quantity * portions[unit], confidence: 'high' }
      // Quantity + unit that doesn't map cleanly — best guess on base units.
      return { multiplier: quantity, confidence: 'medium' }
    }
    // Quantity, no unit → that many base units.
    return { multiplier: quantity, confidence: 'high' }
  }

  // No quantity. Look for a portion keyword anywhere in the text (e.g. "whole tub").
  for (const key of Object.keys(portions)) {
    if (new RegExp(`\\b${key}\\b`).test(rawLower)) {
      return { multiplier: portions[key], confidence: 'high' }
    }
  }
  if (unit && unit === entry.unit) return { multiplier: 1, confidence: 'high' }

  // Bare food name → its default amount.
  return {
    multiplier: entry.defaultAmount ?? 1,
    confidence: entry.defaultAmount != null ? 'medium' : 'high',
  }
}

/** Estimate macros for a single parsed segment. */
export function estimateSegment(seg: ParsedSegment, db: FoodEntry[]): FoodEstimate {
  const match = matchFood(seg.foodText, db)

  if (!match) {
    // Unknown food: low-confidence generic estimate so totals still move.
    return {
      foodName: seg.foodText || seg.raw,
      amount: seg.quantity ?? 1,
      unit: seg.unit ?? 'item',
      calories: 150,
      protein: 10,
      carbs: 12,
      fat: 7,
      confidence: 'low',
      matched: false,
    }
  }

  const { entry } = match
  const { multiplier, confidence } = resolveMultiplier(seg, entry)

  return {
    foodName: entry.name,
    amount: r1(multiplier),
    unit: entry.unit,
    calories: r0(entry.calories * multiplier),
    protein: r1(entry.protein * multiplier),
    carbs: r1(entry.carbs * multiplier),
    fat: r1(entry.fat * multiplier),
    confidence,
    matched: true,
  }
}

const CONF_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }
const RANK_CONF: Record<number, Confidence> = { 3: 'high', 2: 'medium', 1: 'low' }

/** Estimate a whole meal from raw text. */
export function estimateMeal(rawText: string, customFoods: FoodEntry[] = []): MealEstimate {
  const db = getFoodDatabase(customFoods)
  const segments = parseMeal(rawText)
  const parsedFoods = segments.map((s) => estimateSegment(s, db))

  const calories = r0(parsedFoods.reduce((a, f) => a + f.calories, 0))
  const protein = r1(parsedFoods.reduce((a, f) => a + f.protein, 0))
  const carbs = r1(parsedFoods.reduce((a, f) => a + f.carbs, 0))
  const fat = r1(parsedFoods.reduce((a, f) => a + f.fat, 0))

  // Meal confidence = lowest line confidence (weakest link).
  const minRank = parsedFoods.length
    ? Math.min(...parsedFoods.map((f) => CONF_RANK[f.confidence]))
    : 2
  const confidence = RANK_CONF[minRank] ?? 'medium'

  return { parsedFoods, calories, protein, carbs, fat, confidence }
}

/** Protein efficiency: grams of protein per 100 kcal. */
export function proteinEfficiency(protein: number, calories: number): number {
  if (calories <= 0) return 0
  return (protein / calories) * 100
}

import type { ProteinBadge } from './types'

export function proteinBadge(protein: number, calories: number): ProteinBadge {
  const eff = proteinEfficiency(protein, calories)
  if (eff > 18) return 'Elite PSMF'
  if (eff >= 12) return 'Strong'
  if (eff >= 8) return 'Acceptable'
  return 'Poor for cut'
}
