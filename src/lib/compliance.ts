import type { ComplianceStatus, DailyLog, DayType, UserSettings } from './types'
import { dayTargets, estimateMaintenance, type DayTargets } from './dayType'

export interface ComplianceBreakdown {
  protein: number // 0-3
  carbs: number // 0-2
  fat: number // 0-2
  calories: number // 0-2
  logging: number // 0-1
}

export interface ComplianceResult {
  score: number // 0-10, one decimal
  breakdown: ComplianceBreakdown
  status: ComplianceStatus
  hasData: boolean
  /** The day type the score was graded against (planned intention, else strict PSMF). */
  gradedAs: DayType
}

function scoreProtein(p: number, s: UserSettings): number {
  if (p >= s.proteinMin) return 3 // at/above target (over-max protein is fine on PSMF)
  if (p >= s.proteinMin * 0.75) return 2
  if (p >= s.proteinMin * 0.5) return 1
  return 0
}

function scoreCarbs(c: number, t: DayTargets): number {
  if (c <= t.carbMax) return 2
  if (c <= t.carbMax * 1.5) return 1
  return 0
}

function scoreFat(f: number, t: DayTargets): number {
  if (f <= t.fatMax) return 2
  if (f <= t.fatMax * 1.5) return 1
  return 0
}

function scoreCalories(cal: number, t: DayTargets): number {
  if (cal >= t.calMin && cal <= t.calMax) return 2
  // Mild miss (within ~15% of a bound) keeps a point.
  if (cal < t.calMin && cal >= t.calMin * 0.7) return 1
  if (cal > t.calMax && cal <= t.calMax * 1.15) return 1
  return 0
}

function scoreLogging(log: DailyLog): number {
  let pts = 0
  if (log.meals.length > 0) pts += 0.5
  if (log.meals.length >= 3) pts += 0.25
  if (log.morningWeight != null) pts += 0.25
  return Math.min(1, pts)
}

export function statusFromScore(score: number): ComplianceStatus {
  if (score >= 9) return 'Excellent'
  if (score >= 8) return 'Strong'
  if (score >= 7) return 'Acceptable'
  if (score >= 5) return 'Marginal'
  return 'Off Plan'
}

/**
 * Score a day's adherence (0–10). When the user has declared an intentional
 * Refeed/Maintenance/Moderate day, the carb/calorie/fat sub-scores are graded
 * against that plan — so an intentional refeed is not automatically "off plan".
 * Unplanned days are graded strictly against PSMF targets.
 */
export function computeCompliance(log: DailyLog, settings: UserSettings): ComplianceResult {
  const hasData = log.meals.length > 0
  const gradedAs: DayType = log.plannedType ?? 'PSMF Day'
  const maint = estimateMaintenance(log.morningWeight ?? settings.startingWeight)
  const t = dayTargets(gradedAs, settings, maint)

  const breakdown: ComplianceBreakdown = {
    protein: hasData ? scoreProtein(log.totalProtein, settings) : 0,
    carbs: hasData ? scoreCarbs(log.totalCarbs, t) : 0,
    fat: hasData ? scoreFat(log.totalFat, t) : 0,
    calories: hasData ? scoreCalories(log.totalCalories, t) : 0,
    logging: scoreLogging(log),
  }

  const raw =
    breakdown.protein + breakdown.carbs + breakdown.fat + breakdown.calories + breakdown.logging
  const score = Math.round(raw * 10) / 10

  return {
    score,
    breakdown,
    status: statusFromScore(score),
    hasData,
    gradedAs,
  }
}

/** Color token for a status label. */
export function statusColor(status: ComplianceStatus): string {
  switch (status) {
    case 'Excellent':
    case 'Strong':
      return 'text-good'
    case 'Acceptable':
      return 'text-accent'
    case 'Marginal':
      return 'text-warn'
    case 'Off Plan':
      return 'text-bad'
  }
}
