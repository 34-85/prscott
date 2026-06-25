import type { DailyLog, UserSettings } from './types'
import { computeCompliance } from './compliance'
import { computeForecast, weighIns, rollingTrend, type Forecast } from './forecast'
import { daysBetween, todayKey } from './dates'

export type InsightTone = 'positive' | 'info' | 'caution' | 'alert'

export interface CoachInsight {
  id: string
  tone: InsightTone
  title: string
  body: string
}

/** Average compliance score over the most recent N logged days (with meals). */
function recentCompliance(logs: DailyLog[], settings: UserSettings, n: number): number | null {
  const scored = logs
    .filter((l) => l.meals.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
    .map((l) => computeCompliance(l, settings).score)
  if (scored.length === 0) return null
  return scored.reduce((a, b) => a + b, 0) / scored.length
}

/**
 * Detect a plateau: rolling average essentially flat over 10+ days
 * despite good compliance (>8).
 */
function detectPlateau(
  logs: Record<string, DailyLog>,
  settings: UserSettings,
): { stalled: boolean; days: number } {
  const points = weighIns(logs)
  if (points.length < 4) return { stalled: false, days: 0 }
  const trend = rollingTrend(points)
  const last = trend[trend.length - 1]
  // Find the earliest trend point within a 10+ day window.
  const windowStart = trend.find((t) => daysBetween(t.date, last.date) <= 14)
  if (!windowStart) return { stalled: false, days: 0 }
  const span = daysBetween(windowStart.date, last.date)
  if (span < 10) return { stalled: false, days: span }
  const delta = Math.abs(last.rolling - windowStart.rolling)
  const avgComp = recentCompliance(Object.values(logs), settings, 10)
  const stalled = delta < 0.5 && (avgComp == null || avgComp > 8)
  return { stalled, days: span }
}

export function computeCoachInsights(
  logs: Record<string, DailyLog>,
  settings: UserSettings,
  today = todayKey(),
  forecast?: Forecast,
): CoachInsight[] {
  const fc = forecast ?? computeForecast(logs, settings, today)
  const insights: CoachInsight[] = []
  const logList = Object.values(logs)
  const points = weighIns(logs)

  // --- 1. Single-day weight spike vs. strong compliance -------------------
  if (points.length >= 2) {
    const last = points[points.length - 1]
    const prev = points[points.length - 2]
    const dayChange = last.weight - prev.weight
    const recent3 = recentCompliance(logList, settings, 3)
    if (dayChange >= 1.0 && recent3 != null && recent3 >= 8) {
      insights.push({
        id: 'water-spike',
        tone: 'info',
        title: `Scale up ${dayChange.toFixed(1)} lb — compliance ${recent3.toFixed(1)}`,
        body:
          'Weight increase likely reflects water, sodium, inflammation, or glycogen. ' +
          'Your intake data does not suggest fat gain. Hold the line and watch the 7-day trend, not the single reading.',
      })
    } else if (dayChange >= 1.0) {
      insights.push({
        id: 'daily-noise',
        tone: 'info',
        title: `Scale up ${dayChange.toFixed(1)} lb overnight`,
        body:
          'Day-to-day weight swings of 1–3 lb are normal water movement. ' +
          'Judge progress by the rolling average across the week.',
      })
    }
  }

  // --- 2. Plateau detection ----------------------------------------------
  const plateau = detectPlateau(logs, settings)
  if (plateau.stalled) {
    insights.push({
      id: 'plateau',
      tone: 'caution',
      title: `Trend flat for ${plateau.days} days`,
      body:
        'The 7-day average has held steady despite solid compliance. This reads as a genuine plateau, not noise. ' +
        'Consider: trim calories ~100–150/day, add 15–20 min daily activity, verify sodium consistency, and prioritize sleep recovery. ' +
        'A single planned refeed can also restore output if you have been deep in deficit.',
    })
  }

  // --- 3. Schedule status ------------------------------------------------
  if (fc.hasData && fc.observedWeeklyLoss != null) {
    if (fc.status === 'Ahead of schedule') {
      insights.push({
        id: 'ahead',
        tone: 'positive',
        title: 'Ahead of schedule',
        body: `Trend pace is ${fc.observedWeeklyLoss.toFixed(2)} lb/week vs a target of ${fc.requiredWeeklyLoss.toFixed(2)}. Maintain current execution — no need to push harder or under-eat.`,
      })
    } else if (fc.status === 'Behind schedule') {
      insights.push({
        id: 'behind',
        tone: 'caution',
        title: 'Behind target pace',
        body: `Trend pace is ${fc.observedWeeklyLoss.toFixed(2)} lb/week vs a target of ${fc.requiredWeeklyLoss.toFixed(2)}. If this holds for another week, tighten calories toward the lower bound or add light daily activity. Avoid drastic cuts.`,
      })
    } else {
      insights.push({
        id: 'on-track',
        tone: 'positive',
        title: 'On schedule',
        body: `Trend pace ${fc.observedWeeklyLoss.toFixed(2)} lb/week is tracking your ${fc.requiredWeeklyLoss.toFixed(2)} lb/week target. Consistency is doing the work.`,
      })
    }
  }

  // --- 4. Protein-shortfall pattern --------------------------------------
  const recentLogged = logList
    .filter((l) => l.meals.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
  if (recentLogged.length >= 3 && recentLogged.every((l) => l.totalProtein < settings.proteinMin)) {
    const avgP =
      recentLogged.reduce((a, l) => a + l.totalProtein, 0) / recentLogged.length
    insights.push({
      id: 'protein-low',
      tone: 'caution',
      title: 'Protein running below floor',
      body: `Last 3 logged days averaged ${avgP.toFixed(0)}g protein, under your ${settings.proteinMin}g minimum. Protein preserves lean mass in a deep deficit — add a shake or a lean protein serving to close the gap.`,
    })
  }

  // --- 5. Today: gentle nudge to finish the day --------------------------
  const todayLog = logs[today]
  if (todayLog && todayLog.meals.length > 0) {
    const remainingP = settings.proteinMin - todayLog.totalProtein
    if (remainingP > 20) {
      insights.push({
        id: 'today-protein',
        tone: 'info',
        title: 'Protein target not yet met today',
        body: `${remainingP.toFixed(0)}g protein remaining to hit your floor. A Slate shake (42g) or a 6 oz chicken breast (53g) would get you there.`,
      })
    }
  }

  // --- 6. Cold start -----------------------------------------------------
  if (points.length < 2 && logList.every((l) => l.meals.length === 0)) {
    insights.push({
      id: 'getting-started',
      tone: 'info',
      title: 'Building your baseline',
      body: 'Log a morning weight and your meals for a few days. Coaching insights sharpen once a 7-day trend forms — single readings are intentionally ignored.',
    })
  }

  return insights
}
