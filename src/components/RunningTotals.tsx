import type { DailyLog, UserSettings } from '../lib/types'

interface MacroRowProps {
  label: string
  value: number
  unit: string
  min?: number
  max?: number
  /** 'floor' = aim to reach min; 'ceiling' = stay under max. */
  mode: 'floor' | 'ceiling'
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n))
}

function MacroBar({ label, value, unit, min, max, mode }: MacroRowProps) {
  // For ceilings, the bar fills toward the max (over = red).
  // For floors, the bar fills toward the min (reaching = good).
  const target = mode === 'ceiling' ? (max ?? 1) : (min ?? 1)
  const pct = clampPct((value / target) * 100)

  let barColor = 'bg-accent'
  let remainLabel = ''

  if (mode === 'ceiling' && max != null) {
    const remaining = max - value
    remainLabel = remaining >= 0 ? `${remaining.toFixed(0)} ${unit} left` : `${Math.abs(remaining).toFixed(0)} ${unit} over`
    barColor = value > max ? 'bg-bad' : value > max * 0.85 ? 'bg-warn' : 'bg-good'
  } else if (mode === 'floor' && min != null) {
    const remaining = min - value
    remainLabel = remaining > 0 ? `${remaining.toFixed(0)} ${unit} to go` : `target met`
    barColor = value >= min ? 'bg-good' : value >= min * 0.6 ? 'bg-warn' : 'bg-accent'
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="stat-label">{label}</span>
        <span className="text-[11px] text-mute-soft">{remainLabel}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-xl font-semibold">{value.toFixed(mode === 'floor' ? 0 : 0)}</span>
        <span className="text-xs text-mute-soft">
          / {mode === 'ceiling' ? max : min} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-soft">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Today's logged totals + remaining allowances against targets. */
export function RunningTotals({ log, settings }: { log: DailyLog; settings: UserSettings }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
      <MacroBar
        label="Protein"
        value={log.totalProtein}
        unit="g"
        min={settings.proteinMin}
        max={settings.proteinMax}
        mode="floor"
      />
      <MacroBar
        label="Calories"
        value={log.totalCalories}
        unit="kcal"
        min={settings.calorieMin}
        max={settings.calorieMax}
        mode="ceiling"
      />
      <MacroBar label="Carbs" value={log.totalCarbs} unit="g" max={settings.carbMax} mode="ceiling" />
      <MacroBar label="Fat" value={log.totalFat} unit="g" max={settings.fatMax} mode="ceiling" />
    </div>
  )
}
