// Day classification — labels each day by how it was actually run, and provides
// the macro targets that day type should be graded against.

import type { DailyLog, DayType, UserSettings } from './types'

export interface DayTargets {
  calMin: number
  calMax: number
  carbMax: number
  fatMax: number
}

/** Rough total daily energy expenditure for a 50+ moderately active professional. */
export function estimateMaintenance(weightLb: number): number {
  return Math.round(weightLb * 11)
}

/** Grading window for each day type (protein floor is graded separately, always). */
export function dayTargets(type: DayType, settings: UserSettings, maintenance: number): DayTargets {
  switch (type) {
    case 'PSMF Day':
      return {
        calMin: settings.calorieMin,
        calMax: settings.calorieMax,
        carbMax: settings.carbMax,
        fatMax: settings.fatMax,
      }
    case 'Moderate Cut Day':
      return {
        calMin: settings.calorieMin,
        calMax: Math.round(maintenance * 0.85),
        carbMax: Math.round(settings.carbMax * 1.75),
        fatMax: Math.round(settings.fatMax * 1.4),
      }
    case 'Maintenance Day':
      return {
        calMin: Math.round(maintenance * 0.8),
        calMax: Math.round(maintenance * 1.12),
        carbMax: Math.round(settings.carbMax * 3),
        fatMax: Math.round(settings.fatMax * 1.8),
      }
    case 'Refeed Day':
      return {
        calMin: settings.calorieMax,
        calMax: Math.round(maintenance * 1.12),
        carbMax: Math.round(settings.carbMax * 3.5),
        fatMax: Math.round(settings.fatMax * 1.5),
      }
  }
}

export interface DayClassification {
  /** What the day looked like from the macros (data-driven). */
  auto: DayType
  /** User-declared intention, if any. */
  planned?: DayType
  /** planned ?? auto — the label to show. */
  effective: DayType
  /** True when the effective type is the user's declared intention. */
  intentional: boolean
  hasData: boolean
}

/** Auto-classify a day from its macros relative to PSMF targets and maintenance. */
export function classifyDayAuto(log: DailyLog, settings: UserSettings): DayType {
  const weight = log.morningWeight ?? settings.startingWeight
  const maint = estimateMaintenance(weight)
  const cal = log.totalCalories
  const carbs = log.totalCarbs

  // Big intentional-looking carb surge with elevated calories reads as a refeed.
  if (carbs > settings.carbMax * 1.75 && cal >= settings.calorieMax * 0.95) return 'Refeed Day'
  if (cal >= maint * 0.85) return 'Maintenance Day'
  if (cal > settings.calorieMax) return 'Moderate Cut Day'
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
}

export function dayTypeStyle(type: DayType): string {
  return STYLES[type]
}

export const DAY_TYPES: DayType[] = [
  'PSMF Day',
  'Moderate Cut Day',
  'Maintenance Day',
  'Refeed Day',
]
