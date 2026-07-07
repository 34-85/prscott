// Day classification + per-day-type calorie/macro targets.

import type { DailyLog, DayProfile, DayType, UserSettings } from './types'

/**
 * Default targets for each day type. These drive BOTH the displayed targets
 * (running totals / remaining) and compliance grading. Editable in Settings.
 */
export const DAY_PROFILES: Record<DayType, DayProfile> = {
  // Strict PSMF: deep deficit, minimal carbs/fat, high protein.
  'PSMF Day': {
    proteinMin: 180,
    proteinMax: 220,
    carbMax: 25,
    fatMax: 25,
    calorieMin: 700,
    calorieMax: 1000, // ~850 target
  },
  // A gentler deficit day.
  'Moderate Cut Day': {
    proteinMin: 170,
    proteinMax: 220,
    carbMax: 75,
    fatMax: 55,
    calorieMin: 1200,
    calorieMax: 1600, // ~1400 target
  },
  // Eat at roughly maintenance.
  'Maintenance Day': {
    proteinMin: 150,
    proteinMax: 220,
    carbMax: 200,
    fatMax: 85,
    calorieMin: 2000,
    calorieMax: 2500, // ~2250 target
  },
  // Carb-focused refeed to restore glycogen/hormones.
  'Refeed Day': {
    proteinMin: 160,
    proteinMax: 220,
    carbMax: 300,
    fatMax: 60,
    calorieMin: 1800,
    calorieMax: 2400, // ~2100 target
  },
  // Travel: hard to eat clean — high across the board, lower protein.
  'Travel Day': {
    proteinMin: 100,
    proteinMax: 180,
    carbMax: 350,
    fatMax: 130,
    calorieMin: 2400,
    calorieMax: 3200, // ~3000 target
  },
}

/** Rough total daily energy expenditure for a 50+ moderately active professional. */
export function estimateMaintenance(weightLb: number): number {
  return Math.round(weightLb * 11)
}

/** The target profile for a given day type (user override, else default). */
export function profileFor(settings: UserSettings, type: DayType): DayProfile {
  return settings.profiles?.[type] ?? DAY_PROFILES[type]
}

/**
 * The active profile for a day: the planned type if declared, otherwise the
 * PSMF baseline. This is what the day's targets and grading use.
 */
export function activeProfile(settings: UserSettings, log: DailyLog): DayProfile {
  return profileFor(settings, log.plannedType ?? 'PSMF Day')
}

export interface DayClassification {
  auto: DayType
  planned?: DayType
  effective: DayType
  intentional: boolean
  hasData: boolean
}

/** Auto-classify a day from its macros relative to the PSMF baseline and maintenance. */
export function classifyDayAuto(log: DailyLog, settings: UserSettings): DayType {
  const weight = log.morningWeight ?? settings.startingWeight
  const maint = estimateMaintenance(weight)
  const psmf = profileFor(settings, 'PSMF Day')
  const cal = log.totalCalories
  const carbs = log.totalCarbs

  if (carbs > psmf.carbMax * 3 && cal >= psmf.calorieMax * 0.95) return 'Refeed Day'
  if (cal >= maint * 0.85) return 'Maintenance Day'
  if (cal > psmf.calorieMax) return 'Moderate Cut Day'
  return 'PSMF Day'
}

export function classifyDay(log: DailyLog, settings: UserSettings): DayClassification {
  const hasData = log.meals.length > 0
  const auto = classifyDayAuto(log, settings)
  const planned = log.plannedType
  const effective = planned ?? auto
  return { auto, planned, effective, intentional: planned != null, hasData }
}

const STYLES: Record<DayType, string> = {
  'PSMF Day': 'text-good border-good/30 bg-good/10',
  'Moderate Cut Day': 'text-accent border-accent/30 bg-accent/10',
  'Maintenance Day': 'text-mute border-ink-line bg-ink-soft',
  'Refeed Day': 'text-warn border-warn/30 bg-warn/10',
  'Travel Day': 'text-bad border-bad/30 bg-bad/10',
}

export function dayTypeStyle(type: DayType): string {
  return STYLES[type]
}

export const DAY_TYPES: DayType[] = [
  'PSMF Day',
  'Moderate Cut Day',
  'Maintenance Day',
  'Refeed Day',
  'Travel Day',
]
