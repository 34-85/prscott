import { useMemo, useState } from 'react'
import { useStore } from '../app/store'
import { getFoodDatabase } from '../lib/foodDatabase'
import { proteinBadge } from '../lib/macroEstimator'
import { BadgePill } from './Badge'
import type { FoodEntry } from '../lib/types'

export function Foods() {
  const { state, addCustomFood, removeCustomFood } = useStore()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const all = useMemo(() => getFoodDatabase(state.customFoods), [state.customFoods])
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return all
    return all.filter(
      (f) => f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.includes(q)),
    )
  }, [all, query])

  const personal = filtered.filter((f) => f.custom || f.priority <= 0)
  const generic = filtered.filter((f) => !f.custom && f.priority > 0)

  return (
    <div className="space-y-4 pb-24 pt-1">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Foods</h1>
        <button onClick={() => setShowAdd(true)} className="btn-ghost px-3 py-1.5 text-sm">
          + Add Food
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search foods or aliases…"
        className="field"
      />

      <Section title="Personal Library" subtitle="Preferred over generic entries" foods={personal} onRemove={removeCustomFood} />
      <Section title="Generic Database" foods={generic} />

      {showAdd && (
        <AddFoodModal
          onClose={() => setShowAdd(false)}
          onAdd={(f) => {
            addCustomFood(f)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

function Section({
  title,
  subtitle,
  foods,
  onRemove,
}: {
  title: string
  subtitle?: string
  foods: FoodEntry[]
  onRemove?: (id: string) => void
}) {
  if (foods.length === 0) return null
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-mute">{title}</h2>
        {subtitle && <span className="text-[11px] text-mute-soft">{subtitle}</span>}
      </div>
      <div className="space-y-2">
        {foods.map((f) => (
          <FoodCard key={f.id + f.name} food={f} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}

function FoodCard({ food, onRemove }: { food: FoodEntry; onRemove?: (id: string) => void }) {
  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{food.name}</span>
            {food.custom && (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                Custom
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-mute-soft">
            {food.servingLabel ?? `per ${food.unit}`}
          </div>
        </div>
        <BadgePill badge={proteinBadge(food.protein, food.calories)} />
      </div>

      <div className="mt-2 flex gap-3 text-[12px] tnum">
        <span>
          <span className="text-white font-medium">{food.calories}</span>{' '}
          <span className="text-mute-soft">kcal</span>
        </span>
        <span className="text-accent">
          {food.protein}<span className="text-mute-soft">P</span>
        </span>
        <span className="text-mute">
          {food.carbs}<span className="text-mute-soft">C</span>
        </span>
        <span className="text-mute">
          {food.fat}<span className="text-mute-soft">F</span>
        </span>
      </div>

      {food.aliases.length > 0 && (
        <div className="mt-2 truncate text-[10px] text-mute-soft">
          aka {food.aliases.slice(0, 4).join(', ')}
        </div>
      )}

      {onRemove && food.custom && (
        <button
          onClick={() => onRemove(food.id)}
          className="mt-2 text-[11px] font-medium text-bad hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  )
}

function AddFoodModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (food: FoodEntry) => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('serving')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [aliases, setAliases] = useState('')

  function submit() {
    if (!name.trim() || !calories) return
    const id = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${Date.now().toString(36)}`
    onAdd({
      id,
      name: name.trim(),
      aliases: aliases
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean)
        .concat(name.trim().toLowerCase()),
      unit: unit.trim() || 'serving',
      servingLabel: `1 ${unit.trim() || 'serving'}`,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      priority: -1,
      defaultAmount: 1,
      custom: true,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-md">
        <div className="rounded-t-3xl border border-ink-line bg-ink-card p-5 pb-8 sm:rounded-3xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Add Personal Food</h2>
            <button onClick={onClose} className="text-sm text-mute-soft hover:text-white">
              Cancel
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <Labeled label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. RXBAR" />
            </Labeled>
            <Labeled label="Base unit">
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className="field" placeholder="serving / scoop / oz" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Calories">
                <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} className="field tnum" />
              </Labeled>
              <Labeled label="Protein (g)">
                <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} className="field tnum" />
              </Labeled>
              <Labeled label="Carbs (g)">
                <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="field tnum" />
              </Labeled>
              <Labeled label="Fat (g)">
                <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} className="field tnum" />
              </Labeled>
            </div>
            <Labeled label="Aliases (comma separated)">
              <input value={aliases} onChange={(e) => setAliases(e.target.value)} className="field" placeholder="rx bar, protein bar" />
            </Labeled>
          </div>

          <button
            onClick={submit}
            disabled={!name.trim() || !calories}
            className="btn-primary mt-4 w-full py-3 disabled:opacity-40"
          >
            Save Food
          </button>
        </div>
      </div>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="stat-label">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
