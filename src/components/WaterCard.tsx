import { useState } from 'react'
import { useStore } from '../app/store'

interface Props {
  date: string
}

/**
 * Water tracking card: quick-add chips, custom amount, undo, and a progress
 * ring toward the daily water goal (from Settings, default 128 oz = 1 gal).
 */
export function WaterCard({ date }: Props) {
  const { state, adjustWater, setWater } = useStore()
  const goal = state.settings.waterGoalOz || 128
  const oz = state.logs[date]?.waterOz ?? 0
  const pct = Math.max(0, Math.min(100, (oz / goal) * 100))
  const [custom, setCustom] = useState('')

  const R = 32
  const C = 2 * Math.PI * R
  const dash = (pct / 100) * C

  const remaining = Math.max(0, goal - oz)
  const complete = oz >= goal
  const gallons = oz / 128

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-mute">Water</h2>
          <p className="mt-0.5 text-[11px] text-mute-soft">
            Goal {goal} oz ({(goal / 128).toFixed(2)} gal)
          </p>
        </div>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="var(--ink-line, #222834)" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              stroke={complete ? '#3ecf8e' : '#4ea1ff'}
              strokeWidth="6"
              strokeDasharray={`${dash} ${C}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="tnum text-base font-bold">{oz.toFixed(0)}</span>
            <span className="text-[9px] text-mute-soft">oz</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[12px] text-mute">
        {complete ? (
          <span className="text-good">Goal met · {gallons.toFixed(2)} gal in.</span>
        ) : (
          <span>
            <span className="tnum text-fg">{remaining.toFixed(0)}</span> oz left today.
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[8, 12, 16, 20, 24, 32].map((n) => (
          <button
            key={n}
            onClick={() => adjustWater(date, n)}
            className="rounded-full border border-ink-line bg-ink-soft px-2.5 py-1 text-[12px] font-medium text-mute hover:border-accent/50 hover:text-fg"
          >
            + {n} oz
          </button>
        ))}
        <button
          onClick={() => adjustWater(date, -8)}
          disabled={oz === 0}
          className="rounded-full border border-ink-line bg-ink-soft px-2.5 py-1 text-[12px] font-medium text-mute hover:border-bad/50 hover:text-bad disabled:opacity-40"
          title="Undo last 8 oz"
        >
          − 8 oz
        </button>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const n = parseFloat(custom)
          if (!isNaN(n) && n > 0) {
            adjustWater(date, n)
            setCustom('')
          }
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="custom oz"
          className="field tnum flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={!custom}
          className="btn-primary px-4 text-sm disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setWater(date, 0)}
          className="btn-ghost px-3 text-[12px] text-mute-soft hover:text-bad"
          title="Reset today's water"
        >
          Reset
        </button>
      </form>
    </div>
  )
}
