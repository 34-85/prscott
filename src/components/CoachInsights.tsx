import type { CoachInsight, InsightTone } from '../lib/coach'

const TONE: Record<InsightTone, { dot: string; ring: string }> = {
  positive: { dot: 'bg-good', ring: 'border-good/25' },
  info: { dot: 'bg-accent', ring: 'border-accent/25' },
  caution: { dot: 'bg-warn', ring: 'border-warn/25' },
  alert: { dot: 'bg-bad', ring: 'border-bad/25' },
}

export function CoachInsights({ insights }: { insights: CoachInsight[] }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">Coach</h2>
        <span className="text-[11px] text-mute-soft">{insights.length} insights</span>
      </div>

      {insights.length === 0 ? (
        <p className="mt-3 text-sm text-mute-soft">
          No flags. Trend and compliance are within expected ranges.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className={`rounded-xl border ${TONE[ins.tone].ring} bg-ink-soft/60 p-3`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${TONE[ins.tone].dot}`} />
                <h3 className="text-sm font-semibold text-fg">{ins.title}</h3>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{ins.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
