import type { DailyLog, ForecastStatus, UserSettings } from './types'
import { addDays, daysBetween, formatLong, todayKey } from './dates'

export const KCAL_PER_LB = 3500

export interface WeighIn {
  date: string
  weight: number
}

export interface TrendPoint {
  date: string
  weight: number
  /** 7-day rolling average of weight up to and including this date. */
  rolling: number
}

export interface Forecast {
  hasData: boolean
  startingWeight: number
  goalWeight: number
  currentWeight?: number
  currentTrend?: number // latest rolling average
  totalLost: number
  remainingLoss: number

  requiredWeeklyLoss: number
  requiredDailyDeficit: number // kcal/day
  observedWeeklyLoss?: number // negative => gaining
  observedDailyLoss?: number

  projectedGoalDate?: string
  projectedGoalDateLabel?: string
  targetGoalDate: string
  targetGoalDateLabel: string

  status: ForecastStatus
  trend: TrendPoint[]
  /** Progress toward goal, 0..1. */
  progress: number
}

/** Extract sorted weigh-ins from logs. */
export function weighIns(logs: Record<string, DailyLog>): WeighIn[] {
  return Object.values(logs)
    .filter((l) => l.morningWeight != null)
    .map((l) => ({ date: l.date, weight: l.morningWeight as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Compute 7-day rolling average trend series. */
export function rollingTrend(points: WeighIn[], window = 7): TrendPoint[] {
  return points.map((p, i) => {
    const startDate = addDays(p.date, -(window - 1))
    const inWindow = points.filter(
      (q, j) => j <= i && q.date >= startDate && q.date <= p.date,
    )
    const avg = inWindow.reduce((a, q) => a + q.weight, 0) / inWindow.length
    return { date: p.date, weight: p.weight, rolling: Math.round(avg * 100) / 100 }
  })
}

/** Least-squares slope (weight units per day). Negative = losing. */
function regressionSlope(points: WeighIn[]): number | null {
  if (points.length < 2) return null
  const base = points[0].date
  const xs = points.map((p) => daysBetween(base, p.date))
  const ys = points.map((p) => p.weight)
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  if (den === 0) return null
  return num / den
}

export function computeForecast(
  logs: Record<string, DailyLog>,
  settings: UserSettings,
  today = todayKey(),
): Forecast {
  const points = weighIns(logs)
  const goalWeight = settings.startingWeight - settings.goalLoss
  const requiredWeeklyLoss = settings.goalLoss / settings.targetWeeks
  const requiredDailyDeficit = (requiredWeeklyLoss / 7) * KCAL_PER_LB

  const startDate = points[0]?.date ?? today
  const targetGoalDate = addDays(startDate, Math.round(settings.targetWeeks * 7))

  const base = {
    startingWeight: settings.startingWeight,
    goalWeight,
    requiredWeeklyLoss,
    requiredDailyDeficit,
    targetGoalDate,
    targetGoalDateLabel: formatLong(targetGoalDate),
  }

  if (points.length === 0) {
    return {
      ...base,
      hasData: false,
      totalLost: 0,
      remainingLoss: settings.goalLoss,
      status: 'On schedule',
      trend: [],
      progress: 0,
    }
  }

  const trend = rollingTrend(points)
  const currentWeight = points[points.length - 1].weight
  const currentTrend = trend[trend.length - 1].rolling
  const totalLost = Math.round((settings.startingWeight - currentTrend) * 100) / 100
  const remainingLoss = Math.round((currentTrend - goalWeight) * 100) / 100

  const slope = regressionSlope(points)
  const observedDailyLoss = slope != null ? -slope : undefined
  const observedWeeklyLoss = observedDailyLoss != null ? observedDailyLoss * 7 : undefined

  let projectedGoalDate: string | undefined
  if (observedDailyLoss != null && observedDailyLoss > 0.0001 && remainingLoss > 0) {
    const daysNeeded = Math.ceil(remainingLoss / observedDailyLoss)
    projectedGoalDate = addDays(today, daysNeeded)
  } else if (remainingLoss <= 0) {
    projectedGoalDate = today // goal already met
  }

  // Status: compare observed weekly loss to required, with a tolerance band.
  let status: ForecastStatus = 'On schedule'
  if (observedWeeklyLoss != null) {
    const ratio = observedWeeklyLoss / requiredWeeklyLoss
    if (ratio >= 1.1) status = 'Ahead of schedule'
    else if (ratio < 0.9) status = 'Behind schedule'
    else status = 'On schedule'
  }
  if (remainingLoss <= 0) status = 'Ahead of schedule'

  const progress = Math.max(0, Math.min(1, totalLost / settings.goalLoss))

  return {
    ...base,
    hasData: true,
    currentWeight,
    currentTrend,
    totalLost,
    remainingLoss,
    observedWeeklyLoss:
      observedWeeklyLoss != null ? Math.round(observedWeeklyLoss * 100) / 100 : undefined,
    observedDailyLoss:
      observedDailyLoss != null ? Math.round(observedDailyLoss * 1000) / 1000 : undefined,
    projectedGoalDate,
    projectedGoalDateLabel: projectedGoalDate ? formatLong(projectedGoalDate) : undefined,
    status,
    trend,
    progress,
  }
}
