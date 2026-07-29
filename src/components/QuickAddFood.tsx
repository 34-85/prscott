import { useMemo, useState } from 'react'
import { getFoodDatabase } from '../lib/foodDatabase'
import { estimateMeal } from '../lib/macroEstimator'
import type { FoodEntry } from '../lib/types'

interface PickerProps {
  customFoods: FoodEntry[]
  /** Called with the composed raw text the estimator understands. */
  onLog: (rawText: string) => void
  /** Optional footer button label (default "Log"). */
  submitLabel?: string
}

/** Unit selector — pinned to a food, plus common alternates. */
function unitsFor(entry: FoodEntry): string[] {
  if (entry.perOunce) return ['oz', 'g', 'serving']
  const set = new Set<string>([entry.unit])
  for (const k of Object.keys(entry.portionRules ?? {})) set.add(k)
  // Always offer generic fallbacks users may recognize
  ;['serving', 'g', 'oz', 'cup'].forEach((u) => set.add(u))
  return Array.from(set)
}

function servingHint(f: FoodEntry): string {
  if (f.servingLabel) return f.servingLabel
  return `1 ${f.unit}`
}

function buildRawText(qty: number, unit: string, food: FoodEntry): string {
  const alias = food.aliases[0] || food.name.toLowerCase()
  if (food.perOunce && unit === 'oz') return `${qty} oz ${alias}`
  if (unit === food.unit) return `${qty} ${unit} ${alias}`
  return `${qty} ${unit} ${alias}`
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

/**
 * The picker itself — search a food, pick quantity + unit, live macro preview,
 * submit. Chromeless so it can be embedded in any container (MealLogger sheet,
 * standalone modal, or its own page). Numbers come from estimateMeal so they
 * match every other entry path.
 */
export function QuickAddPicker({ customFoods, onLog, submitLabel = 'Log Meal' }: PickerProps) {
  const db = useMemo(() => getFoodDatabase(customFoods), [customFoods])

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<FoodEntry | null>(null)
  const [qty, setQty] = useState<string>('1')
  const [unit, setUnit] = useState<string>('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      const featured = new Set([
        'chicken-breast',
        'slate',
        'whey',
        'good-culture-cc',
        'chobani',
        'whole-eggs',
        'egg-whites',
        'sirloin',
        'salmon',
        'shrimp',
        'broccoli',
        'strawberry',
      ])
      return db.filter((f) => featured.has(f.id)).slice(0, 12)
    }
    return db
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.aliases.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 20)
  }, [query, db])

  function pick(entry: FoodEntry) {
    setPicked(entry)
    setUnit(entry.perOunce ? 'oz' : entry.unit)
    setQty(String(entry.defaultAmount ?? 1))
  }

  const preview = useMemo(() => {
    if (!picked) return null
    const n = parseFloat(qty)
    if (!n || n <= 0) return null
    return estimateMeal(buildRawText(n, unit, picked), customFoods)
  }, [picked, qty, unit, customFoods])

  function commit() {
    if (!picked || !preview) return
    const n = parseFloat(qty)
    if (!n || n <= 0) return
    onLog(buildRawText(n, unit, picked))
  }

  return (
    <div>
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPicked(null)
        }}
        placeholder="Search a food (chicken, strawberry, whey…)"
        className="field text-base"
      />

      {!picked && (
        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-ink-line bg-ink-soft/40">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-mute-soft">
              No matches. Try a shorter word — or switch to Describe mode.
            </p>
          ) : (
            matches.map((f) => (
              <button
                key={f.id}
                onClick={() => pick(f)}
                className="flex w-full items-center justify-between border-b border-ink-line px-3 py-2 text-left last:border-b-0 hover:bg-ink-soft"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">{f.name}</div>
                  <div className="text-[11px] text-mute-soft">
                    {servingHint(f)} · {f.calories} kcal · {f.protein}P
                    {f.custom && <span className="ml-1 text-accent">personal</span>}
                  </div>
                </div>
                <span className="text-[11px] text-mute-soft">tap →</span>
              </button>
            ))
          )}
        </div>
      )}

      {picked && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-ink-line bg-ink-soft/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{picked.name}</p>
                <p className="text-[11px] text-mute-soft">Base: {servingHint(picked)}</p>
              </div>
              <button
                onClick={() => setPicked(null)}
                className="text-[11px] text-mute-soft hover:text-fg"
              >
                Change
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <div className="min-w-[110px] flex-1">
                <label className="stat-label">Quantity</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commit()}
                  className="field tnum mt-1 text-base"
                />
              </div>
              <div className="flex-1">
                <label className="stat-label">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="field mt-1 text-base"
                >
                  {unitsFor(picked).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {[0.5, 1, 2, 3, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(String(n))}
                  className="rounded-full border border-ink-line bg-ink-soft px-2 py-0.5 text-[11px] text-mute hover:border-accent/40 hover:text-fg"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {preview && (
            <div className="rounded-2xl border border-ink-line bg-ink-soft/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="tnum text-2xl font-bold">{preview.calories}</span>
                  <span className="text-xs text-mute-soft">kcal</span>
                </div>
                <span className="text-[11px] text-mute-soft">{preview.confidence} confidence</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <Macro label="P" value={preview.protein} accent />
                <Macro label="C" value={preview.carbs} />
                <Macro label="F" value={preview.fat} />
              </div>
            </div>
          )}

          <button
            onClick={commit}
            disabled={!preview}
            className="btn-primary w-full py-3 text-base disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  )
}
