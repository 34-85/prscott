import { useStore } from '../app/store'
import { streakSummary } from '../lib/streaks'
import { todayKey } from '../lib/dates'

/**
 * Compact streak pill: flame + current streak length, PSMF days this week.
 * Sits inline on the Today header next to the compliance score.
 */
export function StreakBadge() {
  const { state } = useStore()
  const summary = streakSummary(state.logs, todayKey())
  const active = summary.current > 0

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tnum ${
        active
          ? 'border-warn/40 bg-warn/10 text-warn'
          : 'border-ink-line bg-ink-soft text-mute-soft'
      }`}
      title={`Best streak: ${summary.longest} · This week ${summary.thisWeek}/7 · Last week ${summary.lastWeek}/7`}
    >
      <span aria-hidden>{active ? '🔥' : '·'}</span>
      <span>{summary.current}-day</span>
      <span className="text-mute-soft">·</span>
      <span>{summary.thisWeek}/7 wk</span>
    </div>
  )
}
