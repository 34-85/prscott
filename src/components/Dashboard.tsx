import { useState } from 'react'
import { useStore } from '../app/store'
import { createEmptyLog } from '../lib/storage'
import { computeForecast } from '../lib/forecast'
import { computeCoachInsights } from '../lib/coach'
import { proteinBadge } from '../lib/macroEstimator'
import { todayKey, formatLong, formatTime } from '../lib/dates'
import { WeightEntry } from './WeightEntry'
import { RunningTotals } from './RunningTotals'
import { ComplianceScore } from './ComplianceScore'
import { ForecastCard } from './ForecastCard'
import { CoachInsights } from './CoachInsights'
import { MealLogger } from './MealLogger'
import { BadgePill } from './Badge'
import type { Meal } from '../lib/types'

export function Dashboard() {
  const { state, deleteMeal } = useStore()
  const date = todayKey()
  const log = state.logs[date] ?? createEmptyLog(date)
  const [showLogger, setShowLogger] = useState(false)

  const forecast = computeForecast(state.logs, state.settings, date)
  const insights = computeCoachInsights(state.logs, state.settings, date, forecast)

  return (
    <div className="space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Today</h1>
          <p className="text-[12px] text-mute-soft">{formatLong(date)}</p>
        </div>
        <ComplianceScore log={log} settings={state.settings} compact />
      </div>

      {/* Weight + macro snapshot */}
      <div className="card p-4">
        <WeightEntry date={date} weight={log.morningWeight} note={log.weightNote} />
        <div className="my-4 h-px bg-ink-line" />
        <RunningTotals log={log} settings={state.settings} />
      </div>

      {/* Compliance detail */}
      <div className="card p-4">
        <ComplianceScore log={log} settings={state.settings} />
      </div>

      {/* Coach */}
      <CoachInsights insights={insights} />

      {/* Forecast */}
      <ForecastCard forecast={forecast} />

      {/* Meals */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute">
            Meals <span className="text-mute-soft">({log.meals.length})</span>
          </h2>
          {log.meals.length > 0 && (
            <span className="tnum text-[11px] text-mute-soft">{log.totalCalories} kcal logged</span>
          )}
        </div>

        {log.meals.length === 0 ? (
          <p className="mt-3 text-sm text-mute-soft">
            No meals logged yet. Tap “Add Meal” to start your day.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {[...log.meals]
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              .map((m) => (
                <MealRow key={m.id} meal={m} onDelete={() => deleteMeal(date, m.id)} />
              ))}
          </div>
        )}
      </div>

      {/* Floating add button */}
      <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-lg px-4">
        <button
          onClick={() => setShowLogger(true)}
          className="btn-primary w-full py-3.5 text-base shadow-lg shadow-accent/20"
        >
          + Add Meal
        </button>
      </div>

      {showLogger && <MealLogger date={date} onClose={() => setShowLogger(false)} />}
    </div>
  )
}

function MealRow({ meal, onDelete }: { meal: Meal; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{meal.rawText}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-mute-soft">
            <span>{formatTime(meal.timestamp)}</span>
            <span>·</span>
            <span className="tnum">
              {meal.protein}P {meal.carbs}C {meal.fat}F
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tnum text-sm font-semibold">{meal.calories}</span>
          <BadgePill badge={proteinBadge(meal.protein, meal.calories)} />
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-line px-3 py-2.5">
          <div className="space-y-1">
            {meal.parsedFoods.map((f, i) => (
              <div key={i} className="flex justify-between text-[12px]">
                <span className="text-mute">
                  {f.amount} {f.unit} · {f.foodName}
                  {!f.matched && <span className="ml-1 text-bad">(guess)</span>}
                </span>
                <span className="tnum text-mute-soft">
                  {f.calories} kcal · {f.protein}P
                </span>
              </div>
            ))}
          </div>
          {meal.notes && <p className="mt-2 text-[12px] text-mute-soft">Note: {meal.notes}</p>}
          <button
            onClick={onDelete}
            className="mt-2 text-[11px] font-medium text-bad hover:underline"
          >
            Delete meal
          </button>
        </div>
      )}
    </div>
  )
}
