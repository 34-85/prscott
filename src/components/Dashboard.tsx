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
import { ChatLogger } from './ChatLogger'
import { DayTypeControl } from './DayTypeControl'
import { BadgePill } from './Badge'
import { RestaurantTag, RestaurantDetail } from './RestaurantCard'
import { errorBand } from '../lib/confidence'
import type { Meal } from '../lib/types'

type Mode = 'chat' | 'structured'
const MODE_KEY = 'psmf-tracker-mode'

export function Dashboard() {
  const { state, deleteMeal } = useStore()
  const date = todayKey()
  const log = state.logs[date] ?? createEmptyLog(date)
  const [showLogger, setShowLogger] = useState(false)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(MODE_KEY) as Mode) || 'chat',
  )

  function changeMode(m: Mode) {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
  }

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

      {/* Day type */}
      <DayTypeControl date={date} />

      {/* Logging mode toggle */}
      <div className="flex rounded-xl border border-ink-line bg-ink-soft p-1">
        {(['chat', 'structured'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
              mode === m ? 'bg-accent text-onaccent' : 'text-mute hover:text-fg'
            }`}
          >
            {m === 'chat' ? 'Chat' : 'Structured'}
          </button>
        ))}
      </div>

      {/* Entry surface */}
      {mode === 'chat' ? (
        <ChatLogger date={date} />
      ) : (
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
                  <MealRow
                    key={m.id}
                    meal={m}
                    onEdit={() => setEditingMeal(m)}
                    onDelete={() => deleteMeal(date, m.id)}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance detail */}
      <div className="card p-4">
        <ComplianceScore log={log} settings={state.settings} />
      </div>

      {/* Coach */}
      <CoachInsights insights={insights} />

      {/* Forecast */}
      <ForecastCard forecast={forecast} />

      {/* Floating add button — structured mode only (chat has its own composer) */}
      {mode === 'structured' && (
        <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-lg px-4">
          <button
            onClick={() => setShowLogger(true)}
            className="btn-primary w-full py-3.5 text-base shadow-lg shadow-accent/20"
          >
            + Add Meal
          </button>
        </div>
      )}

      {(showLogger || editingMeal) && (
        <MealLogger
          date={date}
          editMeal={editingMeal ?? undefined}
          onClose={() => {
            setShowLogger(false)
            setEditingMeal(null)
          }}
        />
      )}
    </div>
  )
}

function MealRow({
  meal,
  onEdit,
  onDelete,
}: {
  meal: Meal
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-fg">{meal.rawText}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-mute-soft">
            <span>{formatTime(meal.timestamp)}</span>
            <span>·</span>
            <span className="tnum">
              {meal.restaurant ? '~' : ''}
              {meal.protein}P {meal.carbs}C {meal.fat}F
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tnum text-sm font-semibold">
            {meal.restaurant ? '~' : ''}
            {meal.calories}
          </span>
          {meal.restaurant ? (
            <RestaurantTag />
          ) : (
            <BadgePill badge={proteinBadge(meal.protein, meal.calories)} />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-line px-3 py-2.5">
          {meal.restaurant ? (
            <RestaurantDetail info={meal.restaurant} confidence={meal.confidence} />
          ) : (
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
          )}
          <p className="mt-2 text-[11px] text-mute-soft">
            Estimate confidence: <span className="text-fg">{meal.confidence}</span>{' '}
            {errorBand(meal.confidence).label} · {errorBand(meal.confidence).source}
          </p>
          {meal.notes && <p className="mt-1 text-[12px] text-mute-soft">Note: {meal.notes}</p>}
          <div className="mt-2 flex gap-4">
            <button
              onClick={onEdit}
              className="text-[11px] font-medium text-accent hover:underline"
            >
              Edit meal
            </button>
            <button
              onClick={onDelete}
              className="text-[11px] font-medium text-bad hover:underline"
            >
              Delete meal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
