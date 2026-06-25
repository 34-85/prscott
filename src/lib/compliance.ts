import type { ComplianceStatus, DailyLog, UserSettings } from './types'

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
}

function scoreProtein(p: number, s: UserSettings): number {
  if (p >= s.proteinMin) return 3 // at/above target (over-max protein is fine on PSMF)
  if (p >= s.proteinMin * 0.75) return 2
  if (p >= s.proteinMin * 0.5) return 1
  return 0
}

function scoreCarbs(c: number, s: UserSettings): number {
  if (c <= s.carbMax) return 2
  if (c <= s.carbMax * 1.5) return 1
  return 0
}

function scoreFat(f: number, s: UserSettings): number {
  if (f <= s.fatMax) return 2
  if (f <= s.fatMax * 1.5) return 1
  return 0
}

function scoreCalories(cal: number, s: UserSettings): number {
  if (cal >= s.calorieMin && cal <= s.calorieMax) return 2
  // Mild miss (within 15% of a bound) keeps a point.
  if (cal < s.calorieMin && cal >= s.calorieMin * 0.7) return 1
  if (cal > s.calorieMax && cal <= s.calorieMax * 1.15) return 1
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

export function computeCompliance(log: DailyLog, settings: UserSettings): ComplianceResult {
  const hasData = log.meals.length > 0
  const breakdown: ComplianceBreakdown = {
    protein: hasData ? scoreProtein(log.totalProtein, settings) : 0,
    carbs: hasData ? scoreCarbs(log.totalCarbs, settings) : 0,
    fat: hasData ? scoreFat(log.totalFat, settings) : 0,
    calories: hasData ? scoreCalories(log.totalCalories, settings) : 0,
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
