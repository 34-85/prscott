import { useStore } from '../app/store'
import { createEmptyLog } from '../lib/storage'
import { classifyDay, dayTypeStyle, DAY_TYPES } from '../lib/dayType'
import { estimateWaterWeight } from '../lib/waterWeight'
import type { DayType } from '../lib/types'

/** Declare the day's intent (PSMF / Moderate Cut / Maintenance / Refeed) or leave it auto. */
export function DayTypeControl({ date }: { date: string }) {
  const { state, setDayType } = useStore()
  const log = state.logs[date] ?? createEmptyLog(date)
  const cls = classifyDay(log, state.settings)
  const water = estimateWaterWeight(date, state.logs, state.settings)

  const selected: DayType | 'auto' = log.plannedType ?? 'auto'
  const lenient = log.plannedType === 'Refeed Day' || log.plannedType === 'Maintenance Day'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">Day Type</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${dayTypeStyle(cls.effective)}`}
        >
          {cls.effective}
          <span className="ml-1 font-normal opacity-70">{cls.intentional ? 'planned' : 'auto'}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip
          label="Auto"
          active={selected === 'auto'}
          onClick={() => setDayType(date, undefined)}
        />
        {DAY_TYPES.map((t) => (
          <Chip
            key={t}
            label={t.replace(' Day', '')}
            active={selected === t}
            onClick={() => setDayType(date, t)}
          />
        ))}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-mute-soft">
        {lenient ? (
          <>
            Graded against your <span className="text-fg">{log.plannedType}</span> plan — elevated
            carbs/calories are intentional and not counted as off-plan. Expect ~{water.min}–
            {water.max} lb temporary water.
          </>
        ) : selected === 'auto' ? (
          <>
            Auto-classified from your macros. Declare a Refeed or Maintenance day to grade it against
            that plan instead of strict PSMF.
          </>
        ) : (
          <>Graded against {log.plannedType} targets.</>
        )}
      </p>
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-ink-line bg-ink-soft text-mute hover:text-fg'
      }`}
    >
      {label}
    </button>
  )
}
