// Natural-language meal parser.
// Splits a raw line into segments, then extracts quantity / unit / modifiers / food.

export interface ParsedSegment {
  raw: string
  quantity?: number
  unit?: string
  modifiers: string[]
  foodText: string
}

/** Units we recognize explicitly. */
export const KNOWN_UNITS = [
  'oz',
  'ounce',
  'ounces',
  'cup',
  'cups',
  'scoop',
  'scoops',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'bottle',
  'bottles',
  'serving',
  'servings',
  'g',
  'gram',
  'grams',
  'pat',
  'tub',
  'can',
]

/** Cooking / preparation modifiers we surface (do not change matching). */
export const KNOWN_MODIFIERS = [
  'low-fat',
  'lowfat',
  'low fat',
  'lean',
  'grilled',
  'baked',
  'sauteed',
  'sautéed',
  'cooked',
  'raw',
  'fried',
  'roasted',
  'skinless',
  'plain',
  'nonfat',
  'non-fat',
]

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
}

/** Normalize a unit token to a canonical short form. */
export function normalizeUnit(u: string): string {
  const t = u.toLowerCase()
  if (['oz', 'ounce', 'ounces'].includes(t)) return 'oz'
  if (['cup', 'cups'].includes(t)) return 'cup'
  if (['scoop', 'scoops'].includes(t)) return 'scoop'
  if (['tbsp', 'tablespoon', 'tablespoons'].includes(t)) return 'tbsp'
  if (['tsp', 'teaspoon', 'teaspoons'].includes(t)) return 'tsp'
  if (['bottle', 'bottles'].includes(t)) return 'bottle'
  if (['serving', 'servings'].includes(t)) return 'serving'
  if (['g', 'gram', 'grams'].includes(t)) return 'g'
  return t
}

/** Parse a fraction / mixed number / number-word leading a segment. */
function parseLeadingQuantity(tokens: string[]): { quantity?: number; rest: string[] } {
  if (tokens.length === 0) return { rest: tokens }
  const first = tokens[0].toLowerCase()

  // Number word (a, two, half...)
  if (first in NUMBER_WORDS) {
    // "half" handled, otherwise integer words
    return { quantity: NUMBER_WORDS[first], rest: tokens.slice(1) }
  }

  // Fraction like 1/2 or 3/4
  const frac = first.match(/^(\d+)\/(\d+)$/)
  if (frac) {
    return { quantity: parseInt(frac[1]) / parseInt(frac[2]), rest: tokens.slice(1) }
  }

  // Mixed number "1 1/2"
  if (/^\d+$/.test(first) && tokens[1]?.match(/^(\d+)\/(\d+)$/)) {
    const m = tokens[1].match(/^(\d+)\/(\d+)$/)!
    return {
      quantity: parseInt(first) + parseInt(m[1]) / parseInt(m[2]),
      rest: tokens.slice(2),
    }
  }

  // Plain decimal or integer
  if (/^\d*\.?\d+$/.test(first)) {
    return { quantity: parseFloat(first), rest: tokens.slice(1) }
  }

  return { rest: tokens }
}

/** Split a raw entry into food segments on separators. */
export function splitSegments(raw: string): string[] {
  return raw
    .split(/,|\band\b|\bplus\b|\bwith\b|\+|&/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Parse one segment into structured fields. */
export function parseSegment(raw: string): ParsedSegment {
  let working = ` ${raw.toLowerCase()} `
  const modifiers: string[] = []

  // Extract modifiers (multi-word first)
  for (const mod of KNOWN_MODIFIERS) {
    const re = new RegExp(`\\b${mod.replace(/[-\s]/g, '[-\\s]')}\\b`, 'g')
    if (re.test(working)) {
      modifiers.push(mod.replace(/[-\s]/g, ' ').trim())
      working = working.replace(re, ' ')
    }
  }

  let tokens = working.trim().split(/\s+/).filter(Boolean)

  // Leading quantity
  const { quantity, rest } = parseLeadingQuantity(tokens)
  tokens = rest

  // Unit immediately after quantity (or first token)
  let unit: string | undefined
  if (tokens.length && KNOWN_UNITS.includes(tokens[0].toLowerCase())) {
    unit = normalizeUnit(tokens[0])
    tokens = tokens.slice(1)
  }

  // Drop filler words
  tokens = tokens.filter((t) => !['of', 'a', 'an', 'the'].includes(t.toLowerCase()))

  const foodText = tokens.join(' ').trim()

  return {
    raw: raw.trim(),
    quantity,
    unit,
    modifiers,
    foodText,
  }
}

/** Parse a full raw meal string into segments. */
export function parseMeal(raw: string): ParsedSegment[] {
  return splitSegments(raw).map(parseSegment)
}
