import { useState } from 'react'
import { useStore } from '../app/store'

interface Props {
  date: string
  weight?: number
  note?: string
}

/** Morning weigh-in entry with optional note. */
export function WeightEntry({ date, weight, note }: Props) {
  const { setWeight } = useStore()
  const [editing, setEditing] = useState(weight == null)
  const [val, setVal] = useState(weight != null ? String(weight) : '')
  const [noteVal, setNoteVal] = useState(note ?? '')

  function save() {
    const num = parseFloat(val)
    setWeight(date, isNaN(num) ? undefined : num, noteVal.trim() || undefined)
    if (!isNaN(num)) setEditing(false)
  }

  if (!editing && weight != null) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="stat-label">Morning Weight</div>
          <div className="tnum text-3xl font-bold">
            {weight.toFixed(1)} <span className="text-base font-normal text-mute-soft">lb</span>
          </div>
          {note && <div className="mt-0.5 text-[12px] text-mute-soft">{note}</div>}
        </div>
        <span className="text-[11px] text-accent">Edit</span>
      </button>
    )
  }

  return (
    <div>
      <div className="stat-label mb-1.5">Morning Weight</div>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="lb"
          className="field tnum w-24 text-2xl font-bold"
        />
        <input
          type="text"
          value={noteVal}
          onChange={(e) => setNoteVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Note (optional)"
          className="field flex-1 text-sm"
        />
        <button onClick={save} className="btn-primary px-4">
          Save
        </button>
      </div>
    </div>
  )
}
