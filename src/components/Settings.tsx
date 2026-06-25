import { useEffect, useState } from 'react'
import { useStore } from '../app/store'
import type { MeatWeightMode, UserSettings } from '../lib/types'

interface NumFieldProps {
  label: string
  value: number
  suffix?: string
  step?: number
  onChange: (n: number) => void
}

function NumField({ label, value, suffix, step = 1, onChange }: NumFieldProps) {
  const [local, setLocal] = useState(String(value))
  // Re-sync if the underlying setting changes externally (e.g. demo reload).
  useEffect(() => {
    setLocal(String(value))
  }, [value])
  return (
    <label className="block">
      <span className="stat-label">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          step={step}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(local)
            if (!isNaN(n)) onChange(n)
            else setLocal(String(value))
          }}
          className="field tnum"
        />
        {suffix && <span className="text-xs text-mute-soft">{suffix}</span>}
      </div>
    </label>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-mute">{title}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

export function Settings() {
  const { state, updateSettings, loadDemoData, resetAll } = useStore()
  const s = state.settings

  const set = (patch: Partial<UserSettings>) => updateSettings(patch)

  return (
    <div className="space-y-4 pb-24 pt-1">
      <h1 className="text-xl font-bold tracking-tight">Settings</h1>

      <Group title="Goal">
        <NumField label="Starting Weight" value={s.startingWeight} suffix="lb" step={0.1} onChange={(n) => set({ startingWeight: n })} />
        <NumField label="Goal Loss" value={s.goalLoss} suffix="lb" step={0.5} onChange={(n) => set({ goalLoss: n })} />
        <NumField label="Target Weeks" value={s.targetWeeks} suffix="wk" step={1} onChange={(n) => set({ targetWeeks: n })} />
      </Group>

      <Group title="Protein">
        <NumField label="Protein Min" value={s.proteinMin} suffix="g" onChange={(n) => set({ proteinMin: n })} />
        <NumField label="Protein Max" value={s.proteinMax} suffix="g" onChange={(n) => set({ proteinMax: n })} />
      </Group>

      <Group title="Limits">
        <NumField label="Carb Max" value={s.carbMax} suffix="g" onChange={(n) => set({ carbMax: n })} />
        <NumField label="Fat Max" value={s.fatMax} suffix="g" onChange={(n) => set({ fatMax: n })} />
        <NumField label="Calorie Min" value={s.calorieMin} suffix="kcal" step={10} onChange={(n) => set({ calorieMin: n })} />
        <NumField label="Calorie Max" value={s.calorieMax} suffix="kcal" step={10} onChange={(n) => set({ calorieMax: n })} />
      </Group>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-mute">Default Meat Weight</h2>
        <div className="flex gap-2">
          {(['cooked', 'raw'] as MeatWeightMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => set({ meatWeightsDefault: mode })}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
                s.meatWeightsDefault === mode
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-ink-line bg-ink-soft text-mute hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-mute-soft">
          Logged meat weights are interpreted as {s.meatWeightsDefault} unless stated otherwise.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-1 text-sm font-semibold text-mute">Personal Foods</h2>
        <p className="text-[12px] text-mute-soft">
          Manage your personal food library from the <span className="text-white">Foods</span> tab.
          Personal entries always override generic database matches.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-mute">Data</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              if (confirm('Reload demo data? This replaces your current logs.')) loadDemoData()
            }}
            className="btn-ghost py-2.5"
          >
            Reload Demo Data
          </button>
          <button
            onClick={() => {
              if (confirm('Erase ALL data and start fresh? This cannot be undone.')) resetAll()
            }}
            className="btn py-2.5 border border-bad/40 text-bad hover:bg-bad/10"
          >
            Erase All Data
          </button>
        </div>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-mute-soft">
        This app estimates nutrition and weight trends. It is not medical advice. Very-low-calorie or
        PSMF-style diets should be used carefully, especially with medical conditions or medications.
      </p>
    </div>
  )
}
