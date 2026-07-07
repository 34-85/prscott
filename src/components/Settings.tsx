import { useEffect, useState } from 'react'
import { useStore } from '../app/store'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { DAY_TYPES } from '../lib/dayType'
import type { DayProfile, DayType, MeatWeightMode, UserSettings } from '../lib/types'

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

/** Edit the calorie/macro targets for each day type. */
function DayTargetsEditor() {
  const { state, updateDayProfile } = useStore()
  const [type, setType] = useState<DayType>('PSMF Day')
  const p = state.settings.profiles[type]
  const upd = (patch: Partial<DayProfile>) => updateDayProfile(type, patch)

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-mute">Day Targets</h2>
      <p className="mb-3 mt-0.5 text-[11px] text-mute-soft">
        Calorie &amp; macro targets applied when you plan each day type on the Today tab.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {DAY_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
              type === t
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-ink-line bg-ink-soft text-mute hover:text-fg'
            }`}
          >
            {t.replace(' Day', '')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField key={`${type}-pmin`} label="Protein Min" value={p.proteinMin} suffix="g" onChange={(n) => upd({ proteinMin: n })} />
        <NumField key={`${type}-pmax`} label="Protein Max" value={p.proteinMax} suffix="g" onChange={(n) => upd({ proteinMax: n })} />
        <NumField key={`${type}-carb`} label="Carb Max" value={p.carbMax} suffix="g" onChange={(n) => upd({ carbMax: n })} />
        <NumField key={`${type}-fat`} label="Fat Max" value={p.fatMax} suffix="g" onChange={(n) => upd({ fatMax: n })} />
        <NumField key={`${type}-cmin`} label="Calorie Min" value={p.calorieMin} suffix="kcal" step={10} onChange={(n) => upd({ calorieMin: n })} />
        <NumField key={`${type}-cmax`} label="Calorie Max" value={p.calorieMax} suffix="kcal" step={10} onChange={(n) => upd({ calorieMax: n })} />
      </div>
    </div>
  )
}

export function Settings() {
  const { state, updateSettings, loadDemoData, resetAll } = useStore()
  const s = state.settings
  const [theme, setThemeState] = useState<Theme>(getTheme())

  const set = (patch: Partial<UserSettings>) => updateSettings(patch)

  function chooseTheme(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  return (
    <div className="space-y-4 pb-24 pt-1">
      <h1 className="text-xl font-bold tracking-tight">Settings</h1>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-mute">Appearance</h2>
        <div className="flex gap-2">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => chooseTheme(t)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
                theme === t
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-ink-line bg-ink-soft text-mute hover:text-fg'
              }`}
            >
              {t === 'light' ? '☀ Light' : '☾ Dark'}
            </button>
          ))}
        </div>
      </div>

      <Group title="Goal">
        <NumField label="Starting Weight" value={s.startingWeight} suffix="lb" step={0.1} onChange={(n) => set({ startingWeight: n })} />
        <NumField label="Goal Loss" value={s.goalLoss} suffix="lb" step={0.5} onChange={(n) => set({ goalLoss: n })} />
        <NumField label="Target Weeks" value={s.targetWeeks} suffix="wk" step={1} onChange={(n) => set({ targetWeeks: n })} />
      </Group>

      <DayTargetsEditor />

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
                  : 'border-ink-line bg-ink-soft text-mute hover:text-fg'
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
          Manage your personal food library from the <span className="text-fg">Foods</span> tab.
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
