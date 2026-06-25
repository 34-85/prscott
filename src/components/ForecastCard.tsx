import type { Forecast } from '../lib/forecast'

const STATUS_STYLE: Record<Forecast['status'], string> = {
  'Ahead of schedule': 'text-good bg-good/10 border-good/30',
  'On schedule': 'text-accent bg-accent/10 border-accent/30',
  'Behind schedule': 'text-warn bg-warn/10 border-warn/30',
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="tnum text-lg font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-mute-soft">{sub}</div>}
    </div>
  )
}

export function ForecastCard({ forecast }: { forecast: Forecast }) {
  const fc = forecast

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">Forecast</h2>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[fc.status]}`}
        >
          {fc.status}
        </span>
      </div>

      {/* Progress toward goal */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[11px] text-mute">
          <span className="tnum">
            {fc.currentTrend != null ? fc.currentTrend.toFixed(1) : fc.startingWeight.toFixed(1)} lb
            (trend)
          </span>
          <span className="tnum">goal {fc.goalWeight.toFixed(1)} lb</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-soft">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${fc.progress * 100}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-mute-soft tnum">
          {fc.totalLost.toFixed(1)} lb lost · {Math.max(0, fc.remainingLoss).toFixed(1)} lb to go ·{' '}
          {(fc.progress * 100).toFixed(0)}%
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat
          label="Required Pace"
          value={`${fc.requiredWeeklyLoss.toFixed(2)} lb/wk`}
          sub={`~${Math.round(fc.requiredDailyDeficit)} kcal/day deficit`}
        />
        <Stat
          label="Observed Pace"
          value={
            fc.observedWeeklyLoss != null ? `${fc.observedWeeklyLoss.toFixed(2)} lb/wk` : '—'
          }
          sub={
            fc.observedDailyLoss != null ? `${fc.observedDailyLoss.toFixed(2)} lb/day trend` : 'need more data'
          }
        />
        <Stat
          label="Projected Goal"
          value={fc.projectedGoalDateLabel ? fc.projectedGoalDateLabel.replace(/,.*/, '') : '—'}
          sub={fc.projectedGoalDateLabel ?? 'based on current trend'}
        />
        <Stat
          label="Target Date"
          value={fc.targetGoalDateLabel.replace(/,.*/, '')}
          sub={fc.targetGoalDateLabel}
        />
      </div>
    </div>
  )
}
