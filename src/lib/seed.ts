import type { AppState, DailyLog, DayType, Meal } from './types'
import { DEFAULT_SETTINGS, createEmptyLog, recomputeLog } from './storage'
import { estimateMeal } from './macroEstimator'
import { addDays, parseKey, todayKey } from './dates'

interface MealSpec {
  text: string
  hour: number
  notes?: string
}

interface DaySpec {
  offset: number // days before today (0 = today)
  weight?: number
  weightNote?: string
  meals: MealSpec[]
  coachNotes?: string[]
  plannedType?: DayType
}

function buildMeal(dateKey: string, spec: MealSpec, idx: number): Meal {
  const est = estimateMeal(spec.text)
  const d = parseKey(dateKey)
  d.setHours(spec.hour, 5 * idx, 0, 0)
  return {
    id: `seed_${dateKey}_${idx}`,
    timestamp: d.toISOString(),
    rawText: spec.text,
    parsedFoods: est.parsedFoods,
    calories: est.calories,
    protein: est.protein,
    carbs: est.carbs,
    fat: est.fat,
    confidence: est.confidence,
    notes: spec.notes,
  }
}

/**
 * Demo days, oldest first. Designed to show:
 *  - strong PSMF days
 *  - a mediocre day
 *  - a refeed day (high carb/cal, intentional)
 *  - a water-fluctuation spike day
 */
const DAY_SPECS: DaySpec[] = [
  {
    offset: 13,
    weight: 213.4,
    meals: [
      { text: 'Slate shake', hour: 7 },
      { text: '8 oz grilled chicken breast, asparagus', hour: 12 },
      { text: '2 scoops whey', hour: 16 },
      { text: '10 oz sirloin, salad greens, 1 tbsp olive oil', hour: 19 },
    ],
  },
  {
    offset: 12,
    weight: 213.0,
    meals: [
      { text: '1 cup cottage cheese, berries', hour: 8 },
      { text: '6 oz grilled chicken breast, broccoli', hour: 13 },
      { text: 'Slate shake', hour: 17 },
      { text: '8 oz salmon, asparagus, 1 tsp olive oil', hour: 20 },
    ],
  },
  {
    offset: 11,
    weight: 212.4,
    weightNote: 'Good sleep',
    meals: [
      { text: 'Greek yogurt, berries', hour: 8 },
      { text: '8 oz baked chicken breast, salad with dressing', hour: 12 },
      { text: '2 scoops whey', hour: 16 },
      { text: '6 oz sirloin, broccoli, 1 tbsp butter', hour: 19 },
    ],
  },
  {
    offset: 10,
    weight: 212.6,
    meals: [
      { text: 'Slate shake', hour: 7 },
      { text: 'tuna, salad greens', hour: 12 },
      { text: '8 oz grilled chicken breast, asparagus', hour: 19 },
    ],
    coachNotes: ['Slightly low calories — fine for a single day.'],
  },
  {
    offset: 9,
    weight: 211.8,
    meals: [
      { text: '1 cup cottage cheese', hour: 8 },
      { text: '10 oz grilled chicken breast, broccoli', hour: 13 },
      { text: 'Slate shake', hour: 17 },
      { text: '6 oz cod, salad greens, 1 tbsp olive oil', hour: 20 },
    ],
  },
  {
    // Mediocre day: low protein, higher carbs, sloppy logging
    offset: 8,
    weight: 211.9,
    weightNote: 'Ate out',
    meals: [
      { text: 'greek yogurt', hour: 9 },
      { text: 'salad with dressing', hour: 13 },
      { text: 'turkey sandwich', hour: 19, notes: 'Restaurant — estimated' },
    ],
    coachNotes: ['Mediocre day: protein under floor, carbs elevated.'],
  },
  {
    offset: 7,
    weight: 211.4,
    meals: [
      { text: 'Slate shake', hour: 7 },
      { text: '8 oz grilled chicken breast, asparagus', hour: 12 },
      { text: '2 scoops whey', hour: 16 },
      { text: '8 oz sirloin, broccoli', hour: 19 },
    ],
  },
  {
    // Refeed day: intentional higher carbs/calories
    offset: 6,
    weight: 211.0,
    weightNote: 'Planned refeed',
    plannedType: 'Refeed Day',
    meals: [
      { text: '1 cup cottage cheese, berries', hour: 8 },
      { text: '8 oz grilled chicken breast, 2 cups broccoli', hour: 12 },
      { text: 'Greek yogurt, berries', hour: 16 },
      { text: '10 oz sirloin, salad greens, 1 tbsp olive oil, 1 tbsp butter, berries', hour: 19, notes: 'Refeed — extra carbs intentional' },
    ],
    coachNotes: ['Planned refeed to support training and hormones.'],
  },
  {
    // Water fluctuation day: scale jumps despite strong compliance
    offset: 5,
    weight: 213.1,
    weightNote: 'High sodium yesterday',
    meals: [
      { text: 'Slate shake', hour: 7 },
      { text: '8 oz grilled chicken breast, asparagus', hour: 12 },
      { text: '2 scoops whey', hour: 16 },
      { text: '8 oz salmon, broccoli, 1 tsp olive oil', hour: 20 },
    ],
    coachNotes: ['Scale spike from refeed sodium/glycogen — not fat gain.'],
  },
  {
    offset: 4,
    weight: 211.6,
    meals: [
      { text: 'Greek yogurt, berries', hour: 8 },
      { text: '10 oz grilled chicken breast, salad greens', hour: 13 },
      { text: 'Slate shake', hour: 17 },
      { text: '6 oz sirloin, asparagus, 1 tbsp butter', hour: 19 },
    ],
  },
  {
    offset: 3,
    weight: 210.9,
    meals: [
      { text: '1 cup cottage cheese', hour: 8 },
      { text: '8 oz grilled chicken breast, broccoli', hour: 12 },
      { text: '2 scoops whey', hour: 16 },
      { text: '8 oz cod, salad greens, 1 tbsp olive oil', hour: 20 },
    ],
  },
  {
    offset: 2,
    weight: 210.4,
    meals: [
      { text: 'Slate shake', hour: 7 },
      { text: '6 oz grilled chicken breast, asparagus', hour: 12 },
      { text: 'Greek yogurt', hour: 16 },
      { text: '10 oz sirloin, broccoli', hour: 19 },
    ],
  },
  {
    offset: 1,
    weight: 210.6,
    meals: [
      { text: '1 cup cottage cheese, berries', hour: 8 },
      { text: '8 oz grilled chicken breast, salad with dressing', hour: 13 },
      { text: '2 scoops whey', hour: 16 },
      { text: '8 oz salmon, asparagus, 1 tsp olive oil', hour: 20 },
    ],
  },
  {
    // Today — partial day
    offset: 0,
    weight: 209.9,
    meals: [
      { text: 'Slate shake', hour: 7 },
      { text: '8 oz grilled chicken breast, broccoli', hour: 12 },
    ],
  },
]

export function buildSeedState(today = todayKey()): AppState {
  const logs: Record<string, DailyLog> = {}
  // Starting weight aligned to the oldest seeded weigh-in.
  const settings = { ...DEFAULT_SETTINGS, startingWeight: 213.4 }

  for (const spec of DAY_SPECS) {
    const dateKey = addDays(today, -spec.offset)
    let log = createEmptyLog(dateKey)
    log.morningWeight = spec.weight
    log.weightNote = spec.weightNote
    log.plannedType = spec.plannedType
    log.meals = spec.meals.map((m, i) => buildMeal(dateKey, m, i))
    log.coachNotes = spec.coachNotes ?? []
    log = recomputeLog(log, settings)
    // recomputeLog wipes nothing we set above except totals/score; reattach notes/weight.
    log.coachNotes = spec.coachNotes ?? []
    logs[dateKey] = log
  }

  return {
    settings,
    logs,
    customFoods: [],
    seeded: true,
    version: 1,
  }
}
