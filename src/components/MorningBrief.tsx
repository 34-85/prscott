import { useMemo, useState } from 'react'
import { useStore } from '../app/store'
import { addDays, todayKey } from '../lib/dates'
import { streakSummary, classifyForStreak } from '../lib/streaks'
import { computeCompliance } from '../lib/compliance'
import { profileFor } from '../lib/dayType'
import { computeForecast } from '../lib/forecast'
import type { DailyLog, UserSettings } from '../lib/types'

const DISMISS_KEY = 'psmf-morning-brief-dismissed'

interface BriefParts {
  yesterday: string
  weekLine: string
  forwardLine: string
  tone: 'positive' | 'info' | 'caution'
}

function makeBrief(
  today: string,
  logs: Record<string, DailyLog>,
  settings: UserSettings,
): BriefParts | null {
  const yesterday = logs[addDays(today, -1)]
  const fc = computeForecast(logs, settings, today)
  const summary = streakSummary(logs, today)

  // Yesterday recap — the anchor
  let ySentence = ''
  let tone: 'positive' | 'info' | 'caution' = 'info'

  if (!yesterday || yesterday.meals.length === 0) {
    ySentence = 'Yesterday was empty — no meals logged.'
    tone = 'info'
  } else {
    const res = computeCompliance(yesterday, settings)
    const p = profileFor(settings, yesterday.plannedType ?? 'PSMF Day')
    const hitProtein = yesterday.totalProtein >= p.proteinMin
    const parts: string[] = []
    parts.push(`Yesterday: ${res.score.toFixed(1)}/10 — ${res.status}.`)
    parts.push(
      hitProtein
        ? `Protein floor hit (${yesterday.totalProtein.toFixed(0)}g).`
        : `Protein ${(p.proteinMin - yesterday.totalProtein).toFixed(0)}g short of ${p.proteinMin}g.`,
    )
    ySentence = parts.join(' ')
    tone = res.score >= 8 ? 'positive' : res.score >= 6 ? 'info' : 'caution'
  }

  // 7-day trend
  let weekLine = ''
  if (fc.hasData && fc.observedWeeklyLoss != null) {
    const dir = fc.observedWeeklyLoss > 0.05 ? '↓' : fc.observedWeeklyLoss < -0.05 ? '↑' : '·'
    weekLine = `7-day trend ${dir} ${Math.abs(fc.observedWeeklyLoss).toFixed(2)} lb/week. ` +
      `${summary.thisWeek}/7 PSMF days this week` +
      (summary.lastWeek > 0 ? ` · ${summary.lastWeek}/7 last week.` : '.')
  } else {
    weekLine = `${summary.thisWeek}/7 PSMF days this week. Add weigh-ins to sharpen the trend.`
  }

  // Forward-looking supportive line — grounded but calm
  let forwardLine = ''
  if (summary.current >= 3) {
    forwardLine = `Streak: ${summary.current} straight PSMF days. Same anchor foods today closes another one.`
  } else if (yesterday && classifyForStreak(yesterday) === 'psmf') {
    forwardLine = 'Repeat yesterday and today is on rails. Water first, protein second, everything else after.'
  } else if (yesterday && yesterday.meals.length > 0) {
    forwardLine = 'Yesterday was under target — nothing broken. Start today with a high-protein meal to reset the numbers.'
  } else {
    forwardLine = 'Fresh start today. First move: weigh in, then plan the day type.'
  }

  return { yesterday: ySentence, weekLine, forwardLine, tone }
}

/**
 * A once-per-day recap card. Summarizes yesterday + this week + one forward
 * line, in the coach's neutral, data-first voice. Dismissable — stores the
 * date key so it re-appears the next morning.
 */
export function MorningBrief() {
  const { state } = useStore()
  const today = todayKey()
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === today
    } catch {
      return false
    }
  })

  const brief = useMemo(() => makeBrief(today, state.logs, state.settings), [today, state.logs, state.settings])

  if (dismissed || !brief) return null

  // Skip the card if there is literally nothing to say (fresh install with
  // no logs whatsoever and no yesterday). Otherwise it's an empty greeting.
  const nothingToSay =
    Object.keys(state.logs).length === 0 && !state.logs[addDays(today, -1)]
  if (nothingToSay) return null

  const dot =
    brief.tone === 'positive' ? 'bg-good' : brief.tone === 'caution' ? 'bg-warn' : 'bg-accent'
  const ring =
    brief.tone === 'positive' ? 'border-good/30' : brief.tone === 'caution' ? 'border-warn/30' : 'border-accent/25'

  return (
    <div className={`card border ${ring} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h2 className="text-sm font-semibold text-mute">Morning Brief</h2>
        </div>
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, today)
            } catch {}
            setDismissed(true)
          }}
          className="text-[11px] text-mute-soft hover:text-fg"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-fg">
        <p>{brief.yesterday}</p>
        <p className="text-mute">{brief.weekLine}</p>
        <p className="text-mute">{brief.forwardLine}</p>
      </div>
    </div>
  )
}
