// Core domain types for the PSMF tracker.

export type Confidence = 'high' | 'medium' | 'low'

export type MeatWeightMode = 'cooked' | 'raw'

/** Badge tiers based on protein efficiency (protein g per 100 kcal). */
export type ProteinBadge = 'Elite PSMF' | 'Strong' | 'Acceptable' | 'Poor for cut'

/** PSMF compliance status labels. */
export type ComplianceStatus =
  | 'Excellent'
  | 'Strong'
  | 'Acceptable'
  | 'Marginal'
  | 'Off Plan'

export type ForecastStatus = 'Ahead of schedule' | 'On schedule' | 'Behind schedule'

/** How a day is run. Refeed/Maintenance are legitimate when intentional. */
export type DayType = 'PSMF Day' | 'Moderate Cut Day' | 'Maintenance Day' | 'Refeed Day'

/** A single resolved food line within a meal. */
export interface FoodEstimate {
  foodName: string
  amount: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: Confidence
  /** True when this line was matched against the personal/canonical library. */
  matched?: boolean
}

/** A [min, max] estimate range for each macro. */
export interface MacroRangeTuple {
  calories: [number, number]
  protein: [number, number]
  carbs: [number, number]
  fat: [number, number]
}

/** Restaurant/unknown-meal estimate attached to a meal. Its presence flags restaurant mode. */
export interface RestaurantInfo {
  range: MacroRangeTuple
  /** Calories likely unaccounted for (cooking oils, butter, sauces). */
  hiddenCalories: number
  /** Detected signals: protein source, starch, sauce, visible fat, portion. */
  components: string[]
}

/** A meal: raw text the user typed plus the parsed/estimated result. */
export interface Meal {
  id: string
  timestamp: string // ISO
  rawText: string
  parsedFoods: FoodEstimate[]
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: Confidence
  notes?: string
  /** Set when the meal was logged via restaurant estimation. Macros above are the range midpoints. */
  restaurant?: RestaurantInfo
}

/** A free-form note the user jotted via chat ("slept poorly", "high sodium dinner"). */
export interface DayNote {
  id: string
  timestamp: string // ISO
  text: string
}

/** A day's record. Totals are derived but cached for history rendering. */
export interface DailyLog {
  date: string // YYYY-MM-DD
  morningWeight?: number
  weightNote?: string
  meals: Meal[]
  /** User notes captured in chat mode. */
  notes?: DayNote[]
  /** User-declared intention for the day. When set to Refeed/Maintenance, compliance grades leniently. */
  plannedType?: DayType
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  complianceScore: number
  coachNotes: string[]
}

/** User-configurable plan + targets. */
export interface UserSettings {
  startingWeight: number
  goalLoss: number
  targetWeeks: number
  proteinMin: number
  proteinMax: number
  carbMax: number
  fatMax: number
  calorieMin: number
  calorieMax: number
  meatWeightsDefault: MeatWeightMode
}

/** Canonical / personal-library food definition. */
export interface FoodEntry {
  id: string
  name: string
  aliases: string[]
  /** Macros are stored *per base unit* (per serving, per oz, per scoop, etc.). */
  unit: string
  /** Human label for one base unit, e.g. "1 bottle (15 fl oz)". */
  servingLabel?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  /** Source priority — personal library beats generic. Lower = higher priority. */
  priority: number
  /**
   * Default multiplier applied when the food is named with no explicit amount.
   * e.g. cottage cheese defaults to 1 cup = 2 servings.
   */
  defaultAmount?: number
  /** True when macros are expressed per ounce (used for meat scaling). */
  perOunce?: boolean
  /** Whether weights for this food default to cooked (meats). */
  meat?: boolean
  /** Map of explicit portion phrases to multipliers of the base unit. */
  portionRules?: Record<string, number>
  notes?: string
  /** True for user-added personal foods (editable/removable in settings). */
  custom?: boolean
}

/** Full persisted application state. */
export interface AppState {
  settings: UserSettings
  logs: Record<string, DailyLog> // keyed by date
  customFoods: FoodEntry[]
  seeded: boolean
  version: number
}
