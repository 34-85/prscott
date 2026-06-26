// Restaurant / unknown-meal estimation.
// Restaurant food carries large portions and uncounted cooking fats and sauces,
// so instead of a point estimate we return a MACRO RANGE, a confidence score, and
// the calories likely hidden in oils/butter/sauces.

import type { Confidence, FoodEntry, RestaurantInfo } from './types'
import { estimateMeal } from './macroEstimator'

export interface Range {
  min: number
  max: number
}
const R = (min: number, max: number): Range => ({ min, max })
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max })
const mul = (a: Range, k: number): Range => ({ min: a.min * k, max: a.max * k })
export const rangeMid = (r: Range): number => (r.min + r.max) / 2

export interface RestaurantEstimate {
  calories: Range
  protein: Range
  carbs: Range
  fat: Range
  hiddenCalories: number
  confidence: Confidence
  components: string[]
  note: string
}

interface ProteinProfile {
  name: string
  keys: string[]
  oz: [number, number]
  cal: number // per oz cooked, restaurant-style (slightly fattier)
  p: number
  f: number
}

// Typical restaurant entrée protein portions (oz) and per-oz macros.
const PROTEINS: ProteinProfile[] = [
  { name: 'Chicken', keys: ['chicken'], oz: [6, 9], cal: 50, p: 8.8, f: 1.6 },
  {
    name: 'Beef / steak',
    keys: ['steak', 'sirloin', 'ribeye', 'beef', 'burger', 'cheeseburger', 'filet', 'prime rib', 'brisket'],
    oz: [6, 10],
    cal: 68,
    p: 7.5,
    f: 4.2,
  },
  { name: 'Salmon', keys: ['salmon'], oz: [5, 8], cal: 58, p: 7.2, f: 3.3 },
  {
    name: 'White fish',
    keys: ['cod', 'tilapia', 'halibut', 'white fish', 'whitefish', 'fish', 'flounder', 'mahi'],
    oz: [5, 8],
    cal: 38,
    p: 6.8,
    f: 0.8,
  },
  {
    name: 'Shrimp / seafood',
    keys: ['shrimp', 'prawn', 'scallop', 'seafood', 'crab', 'lobster'],
    oz: [5, 8],
    cal: 32,
    p: 6,
    f: 0.6,
  },
  {
    name: 'Pork',
    keys: ['pork', 'chop', 'ribs', 'carnitas', 'sausage', 'ham'],
    oz: [5, 9],
    cal: 68,
    p: 7,
    f: 4.5,
  },
  { name: 'Turkey', keys: ['turkey'], oz: [5, 8], cal: 50, p: 8.2, f: 1.6 },
  { name: 'Tofu', keys: ['tofu', 'tempeh'], oz: [5, 8], cal: 40, p: 4.5, f: 2.4 },
  { name: 'Eggs / omelet', keys: ['egg', 'omelet', 'omelette', 'frittata'], oz: [4, 7], cal: 75, p: 6, f: 5 },
]
const GENERIC_PROTEIN: ProteinProfile = {
  name: 'Mixed protein plate',
  keys: [],
  oz: [5, 8],
  cal: 58,
  p: 7,
  f: 3.2,
}

interface Modifier {
  name: string
  keys: string[]
  cal: Range
  p?: Range
  c?: Range
  f?: Range
  hidden?: number
  /** scaled by the portion multiplier (true for starches/sides). */
  scalable?: boolean
}

const VISIBLE_FATS: Modifier[] = [
  { name: 'Butter', keys: ['butter', 'buttery'], cal: R(90, 170), f: R(10, 19), hidden: 120 },
  {
    name: 'Oil / fried',
    keys: ['oil', 'olive oil', 'fried', 'deep fried', 'crispy', 'tempura', 'battered', 'breaded'],
    cal: R(110, 280),
    f: R(12, 31),
    hidden: 170,
  },
  {
    name: 'Cheese',
    keys: ['cheese', 'cheddar', 'parmesan', 'mozzarella', 'queso', 'feta', 'melted'],
    cal: R(80, 200),
    f: R(7, 16),
    c: R(1, 4),
    p: R(5, 12),
  },
  { name: 'Avocado / guac', keys: ['avocado', 'guac', 'guacamole'], cal: R(120, 250), f: R(11, 22), c: R(6, 12) },
  { name: 'Bacon', keys: ['bacon'], cal: R(80, 170), f: R(6, 14), p: R(6, 13), hidden: 60 },
  { name: 'Nuts', keys: ['nuts', 'almond', 'walnut', 'pecan', 'peanut', 'cashew'], cal: R(90, 200), f: R(8, 18), c: R(3, 8), p: R(3, 7) },
]

const SAUCES: Modifier[] = [
  {
    name: 'Creamy sauce',
    keys: ['cream', 'creamy', 'alfredo', 'aioli', 'ranch', 'mayo', 'hollandaise', 'bechamel', 'vodka sauce'],
    cal: R(120, 320),
    f: R(12, 32),
    c: R(2, 8),
    hidden: 200,
  },
  { name: 'Gravy', keys: ['gravy'], cal: R(80, 200), f: R(6, 16), c: R(6, 14), hidden: 120 },
  {
    name: 'Sweet glaze',
    keys: ['bbq', 'teriyaki', 'glaze', 'honey', 'sweet chili', 'orange sauce', 'general tso', 'sweet and sour'],
    cal: R(60, 200),
    f: R(1, 5),
    c: R(12, 42),
    hidden: 90,
  },
  { name: 'Pesto', keys: ['pesto'], cal: R(120, 260), f: R(12, 26), c: R(2, 6), hidden: 160 },
  {
    name: 'Dressing / sauce',
    keys: ['dressing', 'sauce', 'vinaigrette', 'drizzle', 'marinara', 'buffalo'],
    cal: R(80, 240),
    f: R(7, 22),
    c: R(3, 12),
    hidden: 120,
  },
]

const STARCHES: Modifier[] = [
  { name: 'Rice', keys: ['rice', 'risotto', 'pilaf'], cal: R(180, 360), c: R(38, 74), p: R(3, 7), f: R(1, 8), scalable: true },
  {
    name: 'Pasta',
    keys: ['pasta', 'noodle', 'noodles', 'spaghetti', 'penne', 'mac and cheese', 'linguine', 'ramen', 'lo mein', 'fettuccine'],
    cal: R(220, 460),
    c: R(42, 86),
    p: R(7, 15),
    f: R(2, 12),
    scalable: true,
  },
  {
    name: 'Fries / chips',
    keys: ['fries', 'fry', 'chips', 'tots', 'hash brown', 'hashbrown'],
    cal: R(300, 560),
    c: R(38, 66),
    f: R(15, 33),
    p: R(4, 8),
    hidden: 160,
    scalable: true,
  },
  { name: 'Potato', keys: ['potato', 'mashed', 'wedges'], cal: R(180, 400), c: R(35, 62), f: R(3, 15), p: R(3, 7), scalable: true },
  {
    name: 'Bread',
    keys: ['bread', 'roll', 'bun', 'toast', 'tortilla', 'wrap', 'pita', 'sandwich', 'sub', 'baguette', 'naan', 'biscuit', 'croissant', 'bagel'],
    cal: R(120, 340),
    c: R(22, 58),
    p: R(4, 11),
    f: R(2, 12),
    scalable: true,
  },
  {
    name: 'Burrito / taco',
    keys: ['burrito', 'quesadilla', 'taco', 'enchilada', 'nachos'],
    cal: R(250, 650),
    c: R(40, 90),
    p: R(10, 28),
    f: R(10, 30),
    scalable: true,
  },
  { name: 'Beans / legumes', keys: ['beans', 'lentil', 'chickpea', 'hummus', 'refried'], cal: R(120, 280), c: R(24, 50), p: R(7, 15), f: R(1, 8), scalable: true },
  { name: 'Pizza', keys: ['pizza'], cal: R(280, 800), c: R(34, 96), p: R(12, 36), f: R(10, 38), scalable: true },
]

const VEG: Modifier = {
  name: 'Vegetables',
  keys: ['vegetable', 'veggies', 'broccoli', 'asparagus', 'greens', 'salad', 'spinach', 'green beans', 'brussels', 'cauliflower', 'zucchini', 'peppers'],
  cal: R(20, 80),
  c: R(4, 14),
  p: R(1, 4),
  f: R(0, 4),
}

const PORTION: { keys: string[]; k: number; label: string }[] = [
  { keys: ['large', 'big', 'double', 'loaded', 'jumbo', 'xl', 'extra large', 'huge', 'platter', 'family'], k: 1.3, label: 'large portion' },
  { keys: ['small', 'half', 'light', 'side', 'mini', 'appetizer', 'starter', 'slider', 'kids'], k: 0.7, label: 'small portion' },
]

function firstHit(hay: string, keys: string[]): string | undefined {
  return keys.find((k) => hay.includes(k))
}

/** Estimate a restaurant / unknown meal as a macro range with hidden-calorie accounting. */
export function estimateRestaurantMeal(text: string): RestaurantEstimate {
  const hay = ` ${text.toLowerCase()} `
  const components: string[] = []
  let cal = R(0, 0)
  let p = R(0, 0)
  let c = R(0, 0)
  let f = R(0, 0)
  let hidden = 0
  let signals = 0

  // Portion size multiplier.
  let k = 1
  for (const por of PORTION) {
    if (firstHit(hay, por.keys)) {
      k = por.k
      components.push(por.label)
      break
    }
  }

  // 1. Protein source (the anchor of the estimate).
  const matched = PROTEINS.find((pr) => pr.keys.some((key) => hay.includes(key)))
  const prof = matched ?? GENERIC_PROTEIN
  const ozLo = prof.oz[0] * k
  const ozHi = prof.oz[1] * k
  cal = add(cal, R(prof.cal * ozLo, prof.cal * ozHi))
  p = add(p, R(prof.p * ozLo, prof.p * ozHi))
  f = add(f, R(prof.f * ozLo, prof.f * ozHi))
  components.push(`${prof.name} (~${Math.round(ozLo)}–${Math.round(ozHi)} oz)`)
  if (matched) signals++

  // 2. Restaurant cooking-fat tax — always present, mostly hidden.
  cal = add(cal, R(50, 150))
  f = add(f, R(5, 15))
  hidden += 100
  components.push('cooking oil/butter')

  // 3. Visible fats, 4. sauces, 5. starches, 6. veg.
  const applyAll = (mods: Modifier[]) => {
    for (const m of mods) {
      if (!firstHit(hay, m.keys)) continue
      const s = m.scalable ? k : 1
      cal = add(cal, mul(m.cal, s))
      if (m.p) p = add(p, mul(m.p, s))
      if (m.c) c = add(c, mul(m.c, s))
      if (m.f) f = add(f, mul(m.f, s))
      if (m.hidden) hidden += m.hidden
      components.push(m.name)
      signals++
    }
  }
  applyAll(VISIBLE_FATS)
  applyAll(SAUCES)
  applyAll(STARCHES)
  if (firstHit(hay, VEG.keys)) {
    cal = add(cal, VEG.cal)
    if (VEG.c) c = add(c, VEG.c)
    if (VEG.p) p = add(p, VEG.p)
    if (VEG.f) f = add(f, VEG.f)
    components.push(VEG.name)
  }

  // Confidence: restaurant meals are inherently uncertain — cap at medium.
  const confidence: Confidence = matched && signals >= 2 ? 'medium' : 'low'

  const round = (r: Range): Range => ({ min: Math.round(r.min), max: Math.round(r.max) })
  const roundCal = (r: Range): Range => ({ min: Math.round(r.min / 5) * 5, max: Math.round(r.max / 5) * 5 })

  return {
    calories: roundCal(cal),
    protein: round(p),
    carbs: round(c),
    fat: round(f),
    hiddenCalories: Math.round(hidden / 5) * 5,
    confidence,
    components,
    note: `Estimated range for a restaurant/unknown meal. ~${Math.round(hidden / 5) * 5} kcal likely hidden in cooking fats and sauces.`,
  }
}

// Note: avoid substrings of common food words (e.g. "grill" would match "grilled").
const RESTAURANT_KEYWORDS = [
  'restaurant', 'takeout', 'take out', 'take-out', 'delivery', 'ordered', 'menu', 'diner',
  'bistro', 'tavern', 'fast food', 'drive thru', 'drive-thru', 'food court',
  'ate out', 'eating out', 'out for', 'dinner out', 'lunch out', 'brunch', 'buffet',
  'mcdonald', 'chipotle', 'panera', 'starbucks', 'chinese food', 'thai food', 'sushi', 'pizza',
  'olive garden', 'cheesecake factory', 'five guys', 'shake shack', 'panda express', 'wendys',
  'taco bell', 'burger king', 'in-n-out', 'in n out',
]

/** Heuristic: does the text name a restaurant / eating-out context? */
export function looksRestaurant(text: string): boolean {
  const h = ` ${text.toLowerCase()} `
  return RESTAURANT_KEYWORDS.some((k) => h.includes(k))
}

/** Should this meal be estimated as a restaurant/unknown meal? */
export function shouldEstimateAsRestaurant(text: string, customFoods: FoodEntry[] = []): boolean {
  if (looksRestaurant(text)) return true
  const est = estimateMeal(text, customFoods)
  // Some food-like content the canonical DB couldn't match.
  return est.parsedFoods.length > 0 && est.parsedFoods.some((fd) => !fd.matched)
}

/** Convert an estimate into the macro + RestaurantInfo fields stored on a Meal. */
export function buildRestaurantMealData(est: RestaurantEstimate): {
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: Confidence
  restaurant: RestaurantInfo
} {
  const m = (r: Range) => Math.round(rangeMid(r))
  return {
    calories: Math.round(rangeMid(est.calories) / 5) * 5,
    protein: m(est.protein),
    carbs: m(est.carbs),
    fat: m(est.fat),
    confidence: est.confidence,
    restaurant: {
      range: {
        calories: [est.calories.min, est.calories.max],
        protein: [est.protein.min, est.protein.max],
        carbs: [est.carbs.min, est.carbs.max],
        fat: [est.fat.min, est.fat.max],
      },
      hiddenCalories: est.hiddenCalories,
      components: est.components,
    },
  }
}
