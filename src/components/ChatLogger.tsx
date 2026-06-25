import { useMemo, useState } from 'react'
import { useStore } from '../app/store'
import { classifyChat, INTENT_META, type ChatIntent } from '../lib/classifier'
import { resolveMealRef } from '../lib/mealRef'
import { shouldEstimateAsRestaurant } from '../lib/restaurant'
import { proteinBadge } from '../lib/macroEstimator'
import { errorBand } from '../lib/confidence'
import { RestaurantTag, RestaurantDetail } from './RestaurantCard'
import { formatTime } from '../lib/dates'
import { createEmptyLog } from '../lib/storage'
import { BadgePill } from './Badge'
import type { Confidence, DayNote, Meal } from '../lib/types'

const CONF_STYLE: Record<Confidence, string> = {
  high: 'text-good',
  medium: 'text-warn',
  low: 'text-bad',
}

type Entry =
  | { kind: 'meal'; ts: string; meal: Meal }
  | { kind: 'note'; ts: string; note: DayNote }

/** Conversational logging surface. Classifies each line and routes it. */
export function ChatLogger({ date }: { date: string }) {
  const { state, addMeal, addRestaurantMeal, addNote, deleteMeal, deleteNote, setWeight, updateMealText } =
    useStore()
  const log = state.logs[date] ?? createEmptyLog(date)
  const [text, setText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const preview: ChatIntent | null = useMemo(
    () => (text.trim() ? classifyChat(text, state.customFoods) : null),
    [text, state.customFoods],
  )

  const entries = useMemo<Entry[]>(() => {
    const meals: Entry[] = log.meals.map((m) => ({ kind: 'meal', ts: m.timestamp, meal: m }))
    const notes: Entry[] = (log.notes ?? []).map((n) => ({ kind: 'note', ts: n.timestamp, note: n }))
    return [...meals, ...notes].sort((a, b) => a.ts.localeCompare(b.ts))
  }, [log.meals, log.notes])

  function submit() {
    const raw = text.trim()
    if (!raw) return
    const intent = classifyChat(raw, state.customFoods)
    setFlash(null)

    switch (intent.type) {
      case 'weight':
        setWeight(date, intent.weight, intent.weightNote ?? log.weightNote)
        setFlash(`Logged morning weight ${intent.weight?.toFixed(1)} lb.`)
        break
      case 'meal': {
        const mealText = intent.mealText ?? raw
        if (shouldEstimateAsRestaurant(mealText, state.customFoods)) {
          addRestaurantMeal(date, mealText)
          setFlash('Estimated as a restaurant/unknown meal — see the range.')
        } else {
          addMeal(date, mealText)
        }
        break
      }
      case 'note':
        addNote(date, intent.note || raw)
        break
      case 'delete': {
        const target = resolveMealRef(log.meals, intent.mealRef ?? '')
        if (target) {
          deleteMeal(date, target.id)
          setFlash(`Deleted “${target.rawText}”.`)
        } else {
          setFlash(
            intent.mealRef
              ? `Couldn't find a meal matching “${intent.mealRef}”.`
              : 'Nothing to delete.',
          )
        }
        break
      }
      case 'correction':
        if (intent.correctionTarget === 'weight') {
          setWeight(date, intent.weight, intent.weightNote ?? log.weightNote)
          setFlash(`Corrected weight to ${intent.weight?.toFixed(1)} lb.`)
        } else {
          // Target the meal that best matches the corrected food; else the latest.
          const ordered = [...log.meals].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          const target = resolveMealRef(log.meals, intent.mealText ?? '') ?? ordered[ordered.length - 1]
          if (target) {
            updateMealText(date, target.id, intent.mealText ?? raw)
            setFlash(`Updated “${target.rawText}”.`)
          } else {
            addMeal(date, intent.mealText ?? raw)
            setFlash('Nothing to correct yet — logged as a new meal.')
          }
        }
        break
    }
    setText('')
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* Transcript */}
      <div className="flex-1 space-y-3 p-4">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ink-soft px-3 py-2 text-[13px] text-mute">
            Log naturally — e.g. <span className="text-white">“214.6 this morning”</span>,{' '}
            <span className="text-white">“Slate shake”</span>, or{' '}
            <span className="text-white">“Correction: that was 10 oz chicken”</span>. I’ll sort it
            out.
          </div>
        </div>

        {log.morningWeight != null && (
          <UserBubble tag="Weight">
            <span className="tnum text-base font-semibold">{log.morningWeight.toFixed(1)} lb</span>
            {log.weightNote && <span className="ml-2 text-[12px] opacity-80">{log.weightNote}</span>}
          </UserBubble>
        )}

        {entries.map((e) =>
          e.kind === 'meal' ? (
            <MealExchange
              key={e.meal.id}
              meal={e.meal}
              onDelete={() => deleteMeal(date, e.meal.id)}
            />
          ) : (
            <NoteBubble key={e.note.id} note={e.note} onDelete={() => deleteNote(date, e.note.id)} />
          ),
        )}

        {entries.length === 0 && log.morningWeight == null && (
          <p className="py-4 text-center text-[12px] text-mute-soft">
            No entries yet today. Say hello with your morning weight.
          </p>
        )}

        {flash && (
          <div className="flex justify-center">
            <span className="rounded-full bg-ink-soft px-3 py-1 text-[11px] text-mute-soft">
              {flash}
            </span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-ink-line bg-ink-soft/40 p-3">
        {preview && (
          <div className="mb-2 flex items-center gap-2 px-1 text-[11px]">
            <span className="text-mute-soft">Reads as</span>
            <span className={`font-semibold ${INTENT_META[preview.type].color}`}>
              {INTENT_META[preview.type].label}
              {preview.type === 'correction' && preview.correctionTarget
                ? ` · ${preview.correctionTarget}`
                : ''}
            </span>
            <span className="text-mute-soft">·</span>
            <span className={CONF_STYLE[preview.confidence]}>{preview.confidence}</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder="Message your tracker…"
            className="field max-h-28 flex-1 resize-none py-2.5"
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="btn-primary h-11 w-11 shrink-0 rounded-xl p-0 text-lg disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}

function UserBubble({ tag, children }: { tag?: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/15 px-3 py-2 text-right text-white">
        {tag && <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{tag}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}

function MealExchange({ meal, onDelete }: { meal: Meal; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/15 px-3 py-2 text-white">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">Meal</div>
          <div className="text-sm">{meal.rawText}</div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-ink-line bg-ink-soft px-3 py-2">
          <button onClick={() => setOpen((o) => !o)} className="block w-full text-left">
            <div className="flex items-center gap-2">
              <span className="tnum text-lg font-bold">
                {meal.restaurant ? '~' : ''}
                {meal.calories}
              </span>
              <span className="text-[11px] text-mute-soft">kcal</span>
              {meal.restaurant ? (
                <RestaurantTag />
              ) : (
                <BadgePill badge={proteinBadge(meal.protein, meal.calories)} />
              )}
              <span className={`text-[10px] ${CONF_STYLE[meal.confidence]}`}>
                {meal.confidence} {errorBand(meal.confidence).label}
              </span>
            </div>
            <div className="tnum mt-0.5 text-[12px] text-mute">
              {meal.restaurant ? '~' : ''}
              {meal.protein}P · {meal.carbs}C · {meal.fat}F · {formatTime(meal.timestamp)}
            </div>
          </button>
          {open && (
            <div className="mt-2 space-y-1 border-t border-ink-line pt-2">
              {meal.restaurant ? (
                <RestaurantDetail info={meal.restaurant} confidence={meal.confidence} />
              ) : (
                meal.parsedFoods.map((f, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-mute">
                      {f.amount} {f.unit} · {f.foodName}
                      {!f.matched && <span className="ml-1 text-bad">(guess)</span>}
                    </span>
                    <span className="tnum text-mute-soft">{f.calories} kcal</span>
                  </div>
                ))
              )}
              <button onClick={onDelete} className="mt-1 text-[11px] font-medium text-bad hover:underline">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NoteBubble({ note, onDelete }: { note: DayNote; onDelete: () => void }) {
  return (
    <div className="flex justify-end">
      <div className="group max-w-[85%] rounded-2xl rounded-tr-sm border border-ink-line bg-ink-soft px-3 py-2 text-right">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-mute-soft">Note</div>
        <div className="text-sm text-mute">{note.text}</div>
        <button
          onClick={onDelete}
          className="mt-0.5 text-[10px] text-mute-soft opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
        >
          delete
        </button>
      </div>
    </div>
  )
}
