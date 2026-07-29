import { useMemo, useState } from 'react'
import { useStore } from '../app/store'
import { todayKey } from '../lib/dates'
import { COACH_TOPICS, answerQuestion, type CoachAnswer, type CoachTopic } from '../lib/coach'

const TONE_STYLES = {
  positive: 'border-good/30 text-good',
  info: 'border-accent/25 text-accent',
  caution: 'border-warn/30 text-warn',
  alert: 'border-bad/30 text-bad',
} as const

/**
 * Preset-question coach. Each button computes a data-grounded answer on the
 * fly — no LLM call, no backend. Answers include real numbers from the store.
 */
export function CoachQnA() {
  const { state } = useStore()
  const today = todayKey()
  const [selected, setSelected] = useState<CoachTopic | null>(null)

  const answer: CoachAnswer | null = useMemo(
    () => (selected ? answerQuestion(selected, state.logs, state.settings, today) : null),
    [selected, state.logs, state.settings, today],
  )

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">Ask the coach</h2>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-[11px] text-mute-soft hover:text-fg"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {COACH_TOPICS.map((t) => {
          const isSelected = selected === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                isSelected
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-ink-line bg-ink-soft text-mute hover:border-accent/50 hover:text-fg'
              }`}
              title={t.hint}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {answer && (
        <div
          className={`mt-3 rounded-xl border ${TONE_STYLES[answer.tone].split(' ')[0]} bg-ink-soft/60 p-3`}
        >
          <h3 className="text-sm font-semibold text-fg">{answer.title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{answer.body}</p>
          <p className="mt-2 text-[10px] uppercase tracking-wide text-mute-soft">
            Answered from your data · no external calls
          </p>
        </div>
      )}
    </div>
  )
}
