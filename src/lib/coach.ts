import type { DailyLog, UserSettings } from './types'
import { computeCompliance } from './compliance'
import { computeForecast, weighIns, rollingTrend, type Forecast } from './forecast'
import { estimateWaterWeight } from './waterWeight'
import { classifyDay } from './dayType'
import { daysBetween, todayKey } from './dates'

export type InsightTone = 'positive' | 'info' | 'caution' | 'alert'

export interface CoachInsight {
  id: string
  tone: InsightTone
  title: string
  body: string
}

// Coach voice: experienced nutrition coach + data analyst + emotionally neutral
// performance advisor. Priorities: accuracy, trend analysis, preventing
// overreaction, reinforcing consistency. No cheerleading, shame, generic
// motivation, or overconfidence — every claim is tied to the data.

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

/** Detect a plateau: rolling average flat over 10+ days despite good compliance. */
function detectPlateau(
  logs: Record<string, DailyLog>,
  settings: UserSettings,
): { stalled: boolean; days: number } {
  const points = weighIns(logs)
  if (points.length < 4) return { stalled: false, days: 0 }
  const trend = rollingTrend(points)
  const last = trend[trend.length - 1]
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

  // --- 1. Intentional day acknowledgment ---------------------------------
  const todayLog = logs[today]
  if (todayLog && todayLog.plannedType && todayLog.meals.length > 0) {
    const t = todayLog.plannedType
    if (t === 'Refeed Day' || t === 'Maintenance Day') {
      const water = estimateWaterWeight(today, logs, settings)
      insights.push({
        id: 'planned-day',
        tone: 'info',
        title: `${t} logged as planned`,
        body:
          `Elevated carbs/calories are by design and are not scored against PSMF targets today. ` +
          `Expect roughly ${water.min}–${water.max} lb of temporary water over the next 1–2 days. ` +
          `It does not represent fat gain and will clear from the trend.`,
      })
    }
  }

  // --- 2. Water-aware analysis of a scale increase -----------------------
  if (points.length >= 2) {
    const last = points[points.length - 1]
    const prev = points[points.length - 2]
    const dayChange = last.weight - prev.weight
    if (dayChange >= 1.0) {
      const water = estimateWaterWeight(last.date, logs, settings)
      const recent3 = recentCompliance(logList, settings, 3)
      const planned = logs[last.date]?.plannedType
      const drivers = water.factors
        .filter((f) => f.name !== 'Normal daily variance')
        .map((f) => f.name.toLowerCase())
      const driverText = drivers.length ? ` Likely drivers: ${drivers.join(', ')}.` : ''
      const benign =
        (recent3 != null && recent3 >= 8) ||
        planned === 'Refeed Day' ||
        planned === 'Maintenance Day'

      insights.push({
        id: 'water-spike',
        tone: 'info',
        title: `Scale +${dayChange.toFixed(1)} lb — modeled water ${water.min}–${water.max} lb`,
        body:
          `The water model attributes ${water.min}–${water.max} lb of this move to temporary ` +
          `factors.${driverText} ` +
          (benign
            ? 'Intake and compliance do not indicate fat gain. '
            : 'Confirm intake before drawing conclusions. ') +
          'Read the 7-day average, not the single reading.',
      })
    }
  }

  // --- 3. Plateau detection ----------------------------------------------
  const plateau = detectPlateau(logs, settings)
  if (plateau.stalled) {
    insights.push({
      id: 'plateau',
      tone: 'caution',
      title: `Trend flat for ${plateau.days} days`,
      body:
        'The 7-day average has held steady despite compliance above 8 — this reads as a genuine plateau, not noise. ' +
        'Options, in order of preference: trim 100–150 kcal/day, add 15–20 min daily activity, hold sodium consistent, and prioritize sleep. ' +
        'A single planned refeed can also restore output after a long deficit.',
    })
  }

  // --- 4. Schedule status (neutral, numeric) -----------------------------
  if (fc.hasData && fc.observedWeeklyLoss != null) {
    if (fc.status === 'Ahead of schedule') {
      insights.push({
        id: 'ahead',
        tone: 'info',
        title: 'Ahead of required pace',
        body: `Trend pace ${fc.observedWeeklyLoss.toFixed(2)} lb/week vs ${fc.requiredWeeklyLoss.toFixed(2)} required. Current inputs are sufficient — no need to cut further or push harder.`,
      })
    } else if (fc.status === 'Behind schedule') {
      insights.push({
        id: 'behind',
        tone: 'caution',
        title: 'Behind required pace',
        body: `Trend pace ${fc.observedWeeklyLoss.toFixed(2)} lb/week vs ${fc.requiredWeeklyLoss.toFixed(2)} required. If it holds another week, tighten calories toward the lower bound or add light activity. Avoid drastic cuts.`,
      })
    } else {
      insights.push({
        id: 'on-track',
        tone: 'info',
        title: 'On required pace',
        body: `Trend pace ${fc.observedWeeklyLoss.toFixed(2)} lb/week is matching the ${fc.requiredWeeklyLoss.toFixed(2)} lb/week target. Holding inputs steady sustains it.`,
      })
    }
  }

  // --- 5. Protein-shortfall pattern --------------------------------------
  const recentLogged = logList
    .filter((l) => l.meals.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
  if (recentLogged.length >= 3 && recentLogged.every((l) => l.totalProtein < settings.proteinMin)) {
    const avgP = recentLogged.reduce((a, l) => a + l.totalProtein, 0) / recentLogged.length
    insights.push({
      id: 'protein-low',
      tone: 'caution',
      title: 'Protein below floor for 3 days',
      body: `Last 3 logged days averaged ${avgP.toFixed(0)}g protein, under the ${settings.proteinMin}g minimum. Protein preserves lean mass in a deep deficit — add a shake or a lean protein serving to close the gap.`,
    })
  }

  // --- 6. Today: protein remaining ---------------------------------------
  if (todayLog && todayLog.meals.length > 0 && classifyDay(todayLog, settings).effective !== 'Refeed Day') {
    const remainingP = settings.proteinMin - todayLog.totalProtein
    if (remainingP > 20) {
      insights.push({
        id: 'today-protein',
        tone: 'info',
        title: 'Protein not yet at floor today',
        body: `${remainingP.toFixed(0)}g protein remaining to the minimum. A Slate shake (42g) or a 6 oz chicken breast (53g) closes it.`,
      })
    }
  }

  // --- 7. Cold start -----------------------------------------------------
  if (points.length < 2 && logList.every((l) => l.meals.length === 0)) {
    insights.push({
      id: 'getting-started',
      tone: 'info',
      title: 'Building your baseline',
      body: 'Log a morning weight and meals for a few days. Insights sharpen once a 7-day trend forms — single readings are intentionally ignored.',
    })
  }

  return insights
}
