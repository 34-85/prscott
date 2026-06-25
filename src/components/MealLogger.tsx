import { useMemo, useState } from 'react'
import { useStore } from '../app/store'
import { estimateMeal, proteinBadge } from '../lib/macroEstimator'
import { BadgePill } from './Badge'
import type { Confidence, Meal } from '../lib/types'

interface Props {
  date: string
  onClose: () => void
  /** When set, the sheet edits this meal in place instead of adding a new one. */
  editMeal?: Meal
}

const QUICK_ADDS = [
  'Slate shake',
  '2 scoops whey',
  '8 oz grilled chicken breast',
  '1 cup cottage cheese',
  'Greek yogurt, berries',
  '10 oz sirloin, asparagus, 1 tbsp butter',
]

const CONF_STYLE: Record<Confidence, string> = {
  high: 'text-good',
  medium: 'text-warn',
  low: 'text-bad',
}

/** Natural-language meal entry with live macro preview. Bottom-sheet modal. */
export function MealLogger({ date, onClose, editMeal }: Props) {
  const { state, addMeal, updateMeal } = useStore()
  const isEdit = editMeal != null
  const [text, setText] = useState(editMeal?.rawText ?? '')
  const [notes, setNotes] = useState(editMeal?.notes ?? '')

  const preview = useMemo(
    () => (text.trim() ? estimateMeal(text, state.customFoods) : null),
    [text, state.customFoods],
  )

  function submit() {
    if (!text.trim()) return
    if (isEdit) {
      // Re-estimate but preserve the meal's id and original timestamp.
      const est = estimateMeal(text.trim(), state.customFoods)
      updateMeal(date, {
        ...editMeal,
        rawText: text.trim(),
        parsedFoods: est.parsedFoods,
        calories: est.calories,
        protein: est.protein,
        carbs: est.carbs,
        fat: est.fat,
        confidence: est.confidence,
        notes: notes.trim() || undefined,
      })
    } else {
      addMeal(date, text.trim(), notes.trim() || undefined)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-lg">
        <div className="rounded-t-3xl border border-ink-line bg-ink-card p-5 pb-8 sm:rounded-3xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-line sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{isEdit ? 'Edit Meal' : 'Add Meal'}</h2>
            <button onClick={onClose} className="text-sm text-mute-soft hover:text-white">
              Cancel
            </button>
          </div>

          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            rows={2}
            placeholder='e.g. "10 oz sirloin, asparagus, 1 tbsp butter"'
            className="field mt-4 resize-none text-base"
          />

          {/* Quick adds */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_ADDS.map((q) => (
              <button
                key={q}
                onClick={() => setText((t) => (t.trim() ? `${t}, ${q}` : q))}
                className="rounded-full border border-ink-line bg-ink-soft px-2.5 py-1 text-[11px] text-mute hover:border-accent hover:text-white"
              >
                + {q}
              </button>
            ))}
          </div>

          {/* Live preview */}
          {preview && (
            <div className="mt-4 rounded-2xl border border-ink-line bg-ink-soft/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="tnum text-2xl font-bold">{preview.calories}</span>
                  <span className="text-xs text-mute-soft">kcal</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgePill badge={proteinBadge(preview.protein, preview.calories)} />
                  <span className={`text-[11px] font-medium ${CONF_STYLE[preview.confidence]}`}>
                    {preview.confidence} confidence
                  </span>
                </div>
              </div>

              <div className="mt-2 flex gap-4 text-sm">
                <Macro label="P" value={preview.protein} accent />
                <Macro label="C" value={preview.carbs} />
                <Macro label="F" value={preview.fat} />
              </div>

              <div className="mt-3 space-y-1.5 border-t border-ink-line pt-3">
                {preview.parsedFoods.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="truncate text-mute">
                      <span className="text-white">{f.amount}</span> {f.unit} · {f.foodName}
                      {!f.matched && <span className="ml-1 text-bad">(guess)</span>}
                    </span>
                    <span className="tnum shrink-0 text-mute-soft">
                      {f.calories} kcal · {f.protein}P
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="field mt-3 text-sm"
          />

          <button
            onClick={submit}
            disabled={!text.trim()}
            className="btn-primary mt-4 w-full py-3 text-base disabled:opacity-40"
          >
            {isEdit ? 'Save Changes' : 'Log Meal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Macro({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <span className="tnum">
      <span className={accent ? 'font-semibold text-accent' : 'text-mute-soft'}>{label}</span>{' '}
      <span className="font-medium">{value}</span>
      <span className="text-mute-soft">g</span>
    </span>
  )
}
