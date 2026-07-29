// Streak + PSMF-day computations. Purely derived from state.logs — nothing persisted.
//
// Definitions:
//   • A "PSMF day" is a day whose plannedType is PSMF Day (or unset, since PSMF is
//     the app's baseline) AND whose compliance score meets the threshold.
//   • Refeed/Maintenance/Travel days are treated as INTENTIONAL non-PSMF: they
//     neither break nor extend a streak — the streak "pauses" through them.
//   • Days with no meals logged are considered gaps and break the streak.

import type { DailyLog, DayType } from './types'
import { addDays, todayKey } from './dates'

/** A day's PSMF score meets this to count. Mirrors compliance "Acceptable+". */
export const PSMF_STREAK_THRESHOLD = 7

export type DayClass = 'psmf' | 'intentional-off' | 'miss' | 'empty'

const NON_PSMF_TYPES: DayType[] = ['Refeed Day', 'Maintenance Day', 'Travel Day', 'Moderate Cut Day']

/** Classify a single log for streak purposes. */
export function classifyForStreak(log: DailyLog | undefined): DayClass {
  if (!log || log.meals.length === 0) return 'empty'
  const planned = log.plannedType
  if (planned && NON_PSMF_TYPES.includes(planned)) return 'intentional-off'
  return log.complianceScore >= PSMF_STREAK_THRESHOLD ? 'psmf' : 'miss'
}

/** True when the day counts as a PSMF day. */
export function isPsmfDay(log: DailyLog | undefined): boolean {
  return classifyForStreak(log) === 'psmf'
}

/**
 * Current streak ending on `endDate` (today by default). Walks backward from the
 * end date until it hits a miss or an empty day. Intentional off-days (Refeed
 * etc.) do not break the streak but also do not extend it — they are passed
 * through. Today's log is included only if it already qualifies; an empty or
 * still-being-built today does not break yesterday's streak.
 */
export function currentStreak(
  logs: Record<string, DailyLog>,
  endDate = todayKey(),
): { length: number; endedOn?: string } {
  let cursor = endDate
  let length = 0
  let last: string | undefined

  // If today is empty, start counting from yesterday.
  if (classifyForStreak(logs[cursor]) === 'empty') cursor = addDays(cursor, -1)

  // Walk backward — bound the loop so a corrupt state can't run away.
  for (let i = 0; i < 366; i++) {
    const c = classifyForStreak(logs[cursor])
    if (c === 'psmf') {
      length += 1
      if (!last) last = cursor
    } else if (c === 'intentional-off') {
      // pass through
    } else {
      break
    }
    cursor = addDays(cursor, -1)
  }

  return { length, endedOn: last }
}

/** Longest historical streak. Same passthrough rules as currentStreak. */
export function longestStreak(logs: Record<string, DailyLog>): number {
  const dates = Object.keys(logs).sort()
  if (dates.length === 0) return 0
  const start = dates[0]
  const end = dates[dates.length - 1]

  let best = 0
  let run = 0
  let cursor = start
  while (cursor <= end) {
    const c = classifyForStreak(logs[cursor])
    if (c === 'psmf') {
      run += 1
      if (run > best) best = run
    } else if (c === 'intentional-off') {
      // pass through
    } else {
      run = 0
    }
    cursor = addDays(cursor, 1)
  }
  return best
}

/** Start of the ISO week (Monday) containing the given date key. */
export function weekStart(dateKey: string, weekStartsOn: 0 | 1 = 1): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=Sun..6=Sat
  const diff = (dow - weekStartsOn + 7) % 7
  dt.setDate(dt.getDate() - diff)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`
}

export interface WeekPsmfCount {
  weekStart: string
  psmfDays: number
  loggedDays: number
}

/** Count PSMF days in a week starting on `startKey` (Monday by default). */
export function psmfDaysInWeek(logs: Record<string, DailyLog>, startKey: string): WeekPsmfCount {
  let psmf = 0
  let logged = 0
  for (let i = 0; i < 7; i++) {
    const key = addDays(startKey, i)
    const log = logs[key]
    const c = classifyForStreak(log)
    if (c !== 'empty') logged += 1
    if (c === 'psmf') psmf += 1
  }
  return { weekStart: startKey, psmfDays: psmf, loggedDays: logged }
}

/** PSMF-day counts for the last N weeks (oldest first, current week last). */
export function weeklyPsmfSeries(
  logs: Record<string, DailyLog>,
  weeks = 8,
  today = todayKey(),
): WeekPsmfCount[] {
  const currentStart = weekStart(today)
  const out: WeekPsmfCount[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    out.push(psmfDaysInWeek(logs, addDays(currentStart, -i * 7)))
  }
  return out
}

export interface StreakSummary {
  current: number
  longest: number
  thisWeek: number
  lastWeek: number
  /** True when today already qualifies as a PSMF day. */
  todayCounts: boolean
}

/** One-shot summary used by the header badge + morning brief. */
export function streakSummary(
  logs: Record<string, DailyLog>,
  today = todayKey(),
): StreakSummary {
  const current = currentStreak(logs, today).length
  const longest = longestStreak(logs)
  const thisStart = weekStart(today)
  const lastStart = addDays(thisStart, -7)
  const thisWeek = psmfDaysInWeek(logs, thisStart).psmfDays
  const lastWeek = psmfDaysInWeek(logs, lastStart).psmfDays
  return {
    current,
    longest,
    thisWeek,
    lastWeek,
    todayCounts: isPsmfDay(logs[today]),
  }
}
