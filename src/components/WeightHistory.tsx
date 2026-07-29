import { useMemo, useState } from 'react'
import { useStore } from '../app/store'
import { formatShort, todayKey } from '../lib/dates'

interface Row {
  date: string
  weight: number
  note?: string
}

/**
 * Full historical weight log with edit / delete / add-any-past-date. Weights
 * are backed by the same setWeight(date, ...) mutation the Today card uses.
 * Adding a value for a date that has no log yet creates the log via the
 * store's setMorningWeight — no extra plumbing required.
 */
export function WeightHistory() {
  const { state, setWeight } = useStore()

  const rows: Row[] = useMemo(() => {
    return Object.values(state.logs)
      .filter((l) => l.morningWeight != null)
      .map((l) => ({ date: l.date, weight: l.morningWeight!, note: l.weightNote }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [state.logs])

  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editNote, setEditNote] = useState('')

  const [addDate, setAddDate] = useState(todayKey())
  const [addWeight, setAddWeight] = useState('')
  const [addNote, setAddNote] = useState('')

  function startEdit(row: Row) {
    setEditingDate(row.date)
    setEditWeight(String(row.weight))
    setEditNote(row.note ?? '')
  }

  function saveEdit() {
    if (!editingDate) return
    const n = parseFloat(editWeight)
    if (isNaN(n)) return
    setWeight(editingDate, n, editNote.trim() || undefined)
    setEditingDate(null)
  }

  function deleteRow(date: string) {
    if (!confirm(`Delete weight entry for ${formatShort(date)}?`)) return
    setWeight(date, undefined, undefined)
    if (editingDate === date) setEditingDate(null)
  }

  function addRow() {
    const n = parseFloat(addWeight)
    if (isNaN(n) || !addDate) return
    setWeight(addDate, n, addNote.trim() || undefined)
    setAddWeight('')
    setAddNote('')
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">Weight History</h2>
        <span className="text-[11px] text-mute-soft tnum">{rows.length} entries</span>
      </div>

      {/* Add / backfill any past date */}
      <div className="mt-3 rounded-xl border border-ink-line bg-ink-soft/50 p-3">
        <p className="mb-2 text-[11px] text-mute-soft">Backfill or correct any date</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[130px]">
            <label className="stat-label">Date</label>
            <input
              type="date"
              value={addDate}
              max={todayKey()}
              onChange={(e) => setAddDate(e.target.value)}
              className="field mt-1 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className="stat-label">Weight</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={addWeight}
              onChange={(e) => setAddWeight(e.target.value)}
              placeholder="lb"
              className="field tnum mt-1 text-sm"
            />
          </div>
          <div className="flex-[2] min-w-[120px]">
            <label className="stat-label">Note (optional)</label>
            <input
              type="text"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              placeholder="e.g. high sodium"
              className="field mt-1 text-sm"
            />
          </div>
          <button
            onClick={addRow}
            disabled={!addWeight || !addDate}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-mute-soft">No weight entries yet.</p>
      ) : (
        <div className="mt-3 space-y-1">
          {rows.map((r) => {
            const isEdit = editingDate === r.date
            return (
              <div
                key={r.date}
                className="rounded-xl border border-ink-line bg-ink-soft/50 px-3 py-2"
              >
                {isEdit ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[80px]">
                      <label className="stat-label">{formatShort(r.date)}</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="field tnum mt-1 w-24 text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="stat-label">Note</label>
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="field mt-1 text-sm"
                      />
                    </div>
                    <button onClick={saveEdit} className="btn-primary px-3 py-1.5 text-[12px]">
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDate(null)}
                      className="text-[12px] text-mute-soft hover:text-fg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="tnum text-sm font-semibold">
                          {r.weight.toFixed(1)}{' '}
                          <span className="text-[11px] font-normal text-mute-soft">lb</span>
                        </span>
                        <span className="text-[11px] text-mute-soft">{formatShort(r.date)}</span>
                      </div>
                      {r.note && (
                        <div className="truncate text-[11px] text-mute-soft">{r.note}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button
                        onClick={() => startEdit(r)}
                        className="text-[11px] font-medium text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRow(r.date)}
                        className="text-[11px] font-medium text-bad hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
