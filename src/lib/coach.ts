import type { DailyLog, UserSettings } from './types'
import { computeCompliance } from './compliance'
import { computeForecast, weighIns, rollingTrend, type Forecast } from './forecast'
import { estimateWaterWeight } from './waterWeight'
import { classifyDay, profileFor } from './dayType'
import { addDays, daysBetween, todayKey } from './dates'
import { classifyForStreak, streakSummary } from './streaks'

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
  const floorFor = (l: DailyLog) => profileFor(settings, l.plannedType ?? 'PSMF Day').proteinMin
  if (recentLogged.length >= 3 && recentLogged.every((l) => l.totalProtein < floorFor(l))) {
    const avgP = recentLogged.reduce((a, l) => a + l.totalProtein, 0) / recentLogged.length
    insights.push({
      id: 'protein-low',
      tone: 'caution',
      title: 'Protein below floor for 3 days',
      body: `Last 3 logged days averaged ${avgP.toFixed(0)}g protein, under target. Protein preserves lean mass in a deep deficit — add a shake or a lean protein serving to close the gap.`,
    })
  }

  // --- 6. Today: protein remaining ---------------------------------------
  const todayProfile = todayLog ? profileFor(settings, todayLog.plannedType ?? 'PSMF Day') : null
  if (
    todayLog &&
    todayProfile &&
    todayLog.meals.length > 0 &&
    classifyDay(todayLog, settings).effective !== 'Refeed Day' &&
    classifyDay(todayLog, settings).effective !== 'Travel Day'
  ) {
    const remainingP = todayProfile.proteinMin - todayLog.totalProtein
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

// ============================================================================
// Ask-the-coach — templated Q&A grounded in the same data used above.
// Each answer returns concrete numbers whenever possible, in the same coach
// voice: data-forward, no cheerleading, no shame.
// ============================================================================

export type CoachTopic =
  | 'stalling'
  | 'explain-score'
  | 'refeed'
  | 'on-pace'
  | 'today-review'
  | 'streak-status'
  | 'protein-status'
  | 'week-recap'

export interface CoachTopicMeta {
  id: CoachTopic
  label: string
  hint: string
}

/** Preset questions the UI surfaces as buttons. */
export const COACH_TOPICS: CoachTopicMeta[] = [
  { id: 'today-review', label: 'How is today going?', hint: 'macros so far vs targets' },
  { id: 'stalling', label: 'Am I stalling?', hint: '7-day trend' },
  { id: 'on-pace', label: 'Am I on pace?', hint: 'observed vs required' },
  { id: 'explain-score', label: 'Explain my score', hint: 'compliance breakdown' },
  { id: 'protein-status', label: 'Where am I on protein?', hint: '3-day average' },
  { id: 'refeed', label: 'Should I refeed?', hint: 'deficit duration + stall check' },
  { id: 'streak-status', label: "How's my streak?", hint: 'current + best' },
  { id: 'week-recap', label: 'Recap this week', hint: 'PSMF days + avg score' },
]

export interface CoachAnswer {
  topic: CoachTopic
  title: string
  body: string
  tone: InsightTone
}

/** Answer a preset question from state. */
export function answerQuestion(
  topic: CoachTopic,
  logs: Record<string, DailyLog>,
  settings: UserSettings,
  today = todayKey(),
): CoachAnswer {
  const todayLog = logs[today]
  const logList = Object.values(logs)
  const fc = computeForecast(logs, settings, today)
  const summary = streakSummary(logs, today)

  switch (topic) {
    case 'today-review':
      return answerTodayReview(today, todayLog, settings)
    case 'stalling':
      return answerStalling(logs, settings, fc)
    case 'on-pace':
      return answerOnPace(fc)
    case 'explain-score':
      return answerExplainScore(today, todayLog, settings)
    case 'protein-status':
      return answerProteinStatus(logList, settings)
    case 'refeed':
      return answerRefeed(logs, settings, fc)
    case 'streak-status':
      return answerStreakStatus(summary)
    case 'week-recap':
      return answerWeekRecap(logs, settings, today)
  }
}

function answerTodayReview(
  _date: string,
  log: DailyLog | undefined,
  settings: UserSettings,
): CoachAnswer {
  const type = log?.plannedType ?? 'PSMF Day'
  const p = profileFor(settings, type)

  if (!log || log.meals.length === 0) {
    return {
      topic: 'today-review',
      title: 'Nothing logged yet',
      body: `Day is empty so far. Targeting ${p.proteinMin}–${p.proteinMax}g protein and ${p.calorieMin}–${p.calorieMax} kcal. Log the first meal to start the picture.`,
      tone: 'info',
    }
  }

  const remainP = Math.max(0, p.proteinMin - log.totalProtein)
  const remainCal = Math.max(0, p.calorieMax - log.totalCalories)
  const overCarbs = Math.max(0, log.totalCarbs - p.carbMax)
  const overFat = Math.max(0, log.totalFat - p.fatMax)
  const parts: string[] = []
  parts.push(
    `Logged: ${log.totalCalories} kcal, ${log.totalProtein}P / ${log.totalCarbs}C / ${log.totalFat}F.`,
  )
  parts.push(
    remainP > 0
      ? `Protein: ${remainP.toFixed(0)}g short of the ${p.proteinMin}g floor.`
      : `Protein: floor met.`,
  )
  parts.push(
    log.totalCalories < p.calorieMin
      ? `Calories: ${(p.calorieMin - log.totalCalories).toFixed(0)} below the ${p.calorieMin} floor.`
      : log.totalCalories > p.calorieMax
        ? `Calories: ${(log.totalCalories - p.calorieMax).toFixed(0)} over the ${p.calorieMax} ceiling.`
        : `Calories: inside the ${p.calorieMin}–${p.calorieMax} window (${remainCal} left).`,
  )
  if (overCarbs > 0) parts.push(`Carbs ${overCarbs}g over the ${p.carbMax}g cap.`)
  if (overFat > 0) parts.push(`Fat ${overFat}g over the ${p.fatMax}g cap.`)

  const score = computeCompliance(log, settings).score
  parts.push(`Current compliance: ${score.toFixed(1)}/10.`)

  const tone: InsightTone = score >= 8 ? 'positive' : score >= 6 ? 'info' : 'caution'
  return { topic: 'today-review', title: `Today so far — ${type}`, body: parts.join(' '), tone }
}

function answerStalling(
  logs: Record<string, DailyLog>,
  settings: UserSettings,
  fc: Forecast,
): CoachAnswer {
  const points = weighIns(logs)
  if (points.length < 4) {
    return {
      topic: 'stalling',
      title: 'Not enough weight data',
      body: 'A stall verdict needs at least ~10 days of morning weights. Keep logging — single spikes are not signal.',
      tone: 'info',
    }
  }
  const trend = rollingTrend(points)
  const last = trend[trend.length - 1]
  const windowStart = trend.find((t) => daysBetween(t.date, last.date) <= 14) ?? trend[0]
  const span = daysBetween(windowStart.date, last.date)
  const delta = last.rolling - windowStart.rolling

  const avgComp = recentCompliance(Object.values(logs), settings, 10)
  const compNote =
    avgComp == null
      ? ''
      : avgComp >= 8
        ? ` Compliance held above 8, so this is not an intake problem.`
        : avgComp < 7
          ? ` Compliance averaged ${avgComp.toFixed(1)}/10 — intake is the likely lever before anything else.`
          : ''

  if (Math.abs(delta) < 0.5 && span >= 10) {
    return {
      topic: 'stalling',
      title: `Yes — flat for ${span} days`,
      body:
        `The 7-day average moved ${delta.toFixed(1)} lb across ${span} days.${compNote} ` +
        `Options, in order: trim 100–150 kcal/day, add 15–20 min of daily walking, hold sodium consistent, prioritize sleep. ` +
        (fc.observedWeeklyLoss != null
          ? `Trend pace is ${fc.observedWeeklyLoss.toFixed(2)} lb/week vs ${fc.requiredWeeklyLoss.toFixed(2)} required.`
          : ''),
      tone: 'caution',
    }
  }

  if (delta < 0) {
    return {
      topic: 'stalling',
      title: 'No — trend is still moving',
      body: `7-day average is down ${Math.abs(delta).toFixed(1)} lb over the last ${span} days. That is not a stall — hold the current inputs.`,
      tone: 'positive',
    }
  }

  return {
    topic: 'stalling',
    title: 'Trend is bumpy, not stalled',
    body: `7-day average moved +${delta.toFixed(1)} lb across ${span} days. That reads as noise rather than a stall — watch for another week before changing anything.`,
    tone: 'info',
  }
}

function answerOnPace(fc: Forecast): CoachAnswer {
  if (!fc.hasData || fc.observedWeeklyLoss == null) {
    return {
      topic: 'on-pace',
      title: 'Need more weigh-ins',
      body: `Requires ${fc.requiredWeeklyLoss.toFixed(2)} lb/week to hit the goal in ${(fc.requiredWeeklyLoss > 0 ? (fc.remainingLoss / fc.requiredWeeklyLoss).toFixed(1) : '—')} weeks. Observed pace is not yet computable — log a few more mornings.`,
      tone: 'info',
    }
  }
  const obs = fc.observedWeeklyLoss
  const req = fc.requiredWeeklyLoss
  const eta = fc.projectedGoalDateLabel ?? 'not projectable yet'
  const status = fc.status
  const tone: InsightTone =
    status === 'Ahead of schedule' ? 'positive' : status === 'Behind schedule' ? 'caution' : 'info'
  return {
    topic: 'on-pace',
    title: status,
    body: `Trend pace ${obs.toFixed(2)} lb/week vs ${req.toFixed(2)} required. Projected goal date: ${eta}. Target date: ${fc.targetGoalDateLabel}.`,
    tone,
  }
}

function answerExplainScore(
  _date: string,
  log: DailyLog | undefined,
  settings: UserSettings,
): CoachAnswer {
  if (!log || log.meals.length === 0) {
    return {
      topic: 'explain-score',
      title: 'No score yet today',
      body: 'Compliance is only scored once meals are logged. The rubric: protein up to 3 pts, carbs 2, fat 2, calories 2, logging 1.',
      tone: 'info',
    }
  }
  const res = computeCompliance(log, settings)
  const b = res.breakdown
  const rubric = [
    `Protein ${b.protein}/3`,
    `Carbs ${b.carbs}/2`,
    `Fat ${b.fat}/2`,
    `Calories ${b.calories}/2`,
    `Logging ${b.logging.toFixed(1)}/1`,
  ].join(' · ')
  return {
    topic: 'explain-score',
    title: `${res.score.toFixed(1)}/10 — ${res.status}`,
    body: `Graded as ${res.gradedAs}. ${rubric}. Protein weighted highest because it's the non-negotiable macro in a deep deficit.`,
    tone: res.score >= 8 ? 'positive' : res.score >= 6 ? 'info' : 'caution',
  }
}

function answerProteinStatus(logList: DailyLog[], settings: UserSettings): CoachAnswer {
  const recent = logList
    .filter((l) => l.meals.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
  if (recent.length === 0) {
    return {
      topic: 'protein-status',
      title: 'No recent meals logged',
      body: 'Log a few days of meals and protein-adherence patterns will surface here.',
      tone: 'info',
    }
  }
  const floorFor = (l: DailyLog) => profileFor(settings, l.plannedType ?? 'PSMF Day').proteinMin
  const misses = recent.filter((l) => l.totalProtein < floorFor(l))
  const avg = recent.reduce((a, l) => a + l.totalProtein, 0) / recent.length
  if (misses.length === 0) {
    return {
      topic: 'protein-status',
      title: 'Protein on target',
      body: `Last ${recent.length} logged days averaged ${avg.toFixed(0)}g — floor met every day. Keep the same anchor foods.`,
      tone: 'positive',
    }
  }
  const shortAvg = misses.reduce((a, l) => a + (floorFor(l) - l.totalProtein), 0) / misses.length
  return {
    topic: 'protein-status',
    title: `Under floor on ${misses.length}/${recent.length} recent days`,
    body: `Last ${recent.length} logged days averaged ${avg.toFixed(0)}g protein, ~${shortAvg.toFixed(0)}g short on the miss days. Fastest fix: a Slate shake (42g) or 6 oz chicken (53g) to close the gap.`,
    tone: 'caution',
  }
}

function answerRefeed(
  logs: Record<string, DailyLog>,
  _settings: UserSettings,
  fc: Forecast,
): CoachAnswer {
  // A refeed is warranted when: (a) trend has stalled, or (b) at least 12–14
  // consecutive days of deep deficit compliance. Otherwise hold.
  const points = weighIns(logs)
  const trend = points.length >= 2 ? rollingTrend(points) : []
  const last = trend[trend.length - 1]
  const windowStart = last ? trend.find((t) => daysBetween(t.date, last.date) <= 14) : undefined
  const flat =
    last && windowStart && daysBetween(windowStart.date, last.date) >= 10
      ? Math.abs(last.rolling - windowStart.rolling) < 0.5
      : false

  const summary = streakSummary(logs)
  const longDeficit = summary.current >= 12

  if (flat) {
    return {
      topic: 'refeed',
      title: 'A single refeed is reasonable',
      body:
        'Trend has held flat despite good compliance. A 1-day refeed (carbs to 200–300g, fat still low, protein normal) can restore leptin and daily output. Expect 2–4 lb of temporary water the day after — read the 7-day average, not the scale.',
      tone: 'info',
    }
  }
  if (longDeficit) {
    return {
      topic: 'refeed',
      title: `Optional — ${summary.current} consecutive PSMF days`,
      body:
        `You've held ${summary.current} straight PSMF days. A structured refeed here is optional, not required. If mood, sleep, or gym output are dropping, take one. If they're fine, keep going.`,
      tone: 'info',
    }
  }
  return {
    topic: 'refeed',
    title: 'Not yet',
    body:
      (fc.observedWeeklyLoss != null && fc.observedWeeklyLoss > 0.5
        ? `Trend pace is ${fc.observedWeeklyLoss.toFixed(2)} lb/week — the deficit is doing its job. `
        : 'Not enough evidence a refeed is needed. ') +
      'Refeed value comes from having something to break: a plateau, a long deficit, or genuine performance loss. Keep grinding for now.',
    tone: 'info',
  }
}

function answerStreakStatus(summary: ReturnType<typeof streakSummary>): CoachAnswer {
  const parts: string[] = []
  parts.push(
    summary.current === 0
      ? 'No active streak.'
      : `Current streak: ${summary.current} PSMF day${summary.current === 1 ? '' : 's'}.`,
  )
  if (summary.longest > 0) parts.push(`Best: ${summary.longest}.`)
  parts.push(`This week ${summary.thisWeek}/7. Last week ${summary.lastWeek}/7.`)
  if (summary.todayCounts) parts.push("Today's already counted.")
  else if (summary.current > 0) parts.push('Close today above 7/10 to extend it.')
  const tone: InsightTone = summary.current >= 5 ? 'positive' : summary.current > 0 ? 'info' : 'info'
  return {
    topic: 'streak-status',
    title: summary.current === 0 ? 'No active streak' : `${summary.current}-day streak`,
    body: parts.join(' '),
    tone,
  }
}

function answerWeekRecap(
  logs: Record<string, DailyLog>,
  _settings: UserSettings,
  today: string,
): CoachAnswer {
  // Sunday-through-Saturday-agnostic: use rolling 7 days ending today.
  const days: DailyLog[] = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    const l = logs[d]
    if (l) days.push(l)
  }
  const logged = days.filter((l) => l.meals.length > 0)
  if (logged.length === 0) {
    return {
      topic: 'week-recap',
      title: 'No meals logged this week',
      body: "Nothing to recap yet. The recap sharpens once a few days are on the board.",
      tone: 'info',
    }
  }
  const psmf = days.filter((l) => classifyForStreak(l) === 'psmf').length
  const avgScore = logged.reduce((a, l) => a + l.complianceScore, 0) / logged.length
  const avgCal = logged.reduce((a, l) => a + l.totalCalories, 0) / logged.length
  const avgP = logged.reduce((a, l) => a + l.totalProtein, 0) / logged.length
  const weights = days.filter((l) => l.morningWeight != null).map((l) => l.morningWeight!)
  const weightDelta =
    weights.length >= 2 ? weights[weights.length - 1] - weights[0] : undefined
  const dir =
    weightDelta == null ? '' : ` Weight ${weightDelta <= 0 ? '−' : '+'}${Math.abs(weightDelta).toFixed(1)} lb across the window.`
  const tone: InsightTone = avgScore >= 8 ? 'positive' : avgScore >= 6 ? 'info' : 'caution'
  return {
    topic: 'week-recap',
    title: `${psmf}/7 PSMF days · ${avgScore.toFixed(1)}/10 avg`,
    body: `Last 7 days: ${logged.length} logged. Avg ${avgCal.toFixed(0)} kcal, ${avgP.toFixed(0)}g protein.${dir}`,
    tone,
  }
}
