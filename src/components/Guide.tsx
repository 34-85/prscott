import { useState } from 'react'
import { GUIDE_SECTIONS, TOUR_SECTIONS, type GuideSection } from '../lib/guide'

function SectionRow({ s }: { s: GuideSection }) {
  return (
    <div className="flex gap-3">
      <span className="text-2xl leading-none">{s.emoji}</span>
      <div>
        <h3 className="text-sm font-semibold text-fg">{s.title}</h3>
        <p className="mt-0.5 text-[13px] leading-relaxed text-mute">{s.body}</p>
      </div>
    </div>
  )
}

/**
 * Paged "how it works" tour shown at the end of onboarding. Steps through the
 * curated tour screens, then calls onDone (which finishes onboarding).
 */
export function GuideTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const last = i === TOUR_SECTIONS.length - 1
  const s = TOUR_SECTIONS[i]

  return (
    <div>
      <div className="min-h-[176px]">
        <div className="text-4xl">{s.emoji}</div>
        <h2 className="mt-3 text-xl font-bold tracking-tight">{s.title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-mute">{s.body}</p>
      </div>

      <div className="mt-5 flex justify-center gap-1.5">
        {TOUR_SECTIONS.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all ${
              idx === i ? 'w-5 bg-accent' : idx < i ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-ink-line'
            }`}
          />
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        {i > 0 && (
          <button onClick={() => setI(i - 1)} className="btn-ghost flex-1 py-3 text-base">
            Back
          </button>
        )}
        <button
          onClick={() => (last ? onDone() : setI(i + 1))}
          className="btn-primary flex-1 py-3 text-base"
        >
          {last ? 'Start tracking' : 'Next'}
        </button>
      </div>
    </div>
  )
}

/** The full guide as a scrollable list — reused inside the overlay. */
export function GuideContent() {
  return (
    <div className="space-y-5">
      {GUIDE_SECTIONS.map((s) => (
        <SectionRow key={s.title} s={s} />
      ))}
    </div>
  )
}

/** Full-screen, always-available guide, opened from Settings. */
export function GuideOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="relative max-h-[92vh] w-full overflow-y-auto overscroll-contain sm:max-w-lg">
        <div
          className="rounded-t-3xl border border-ink-line bg-ink-card p-5 sm:rounded-3xl"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-line sm:hidden" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">How to use PSMF Tracker</h2>
            <button onClick={onClose} className="btn-ghost px-3 py-1 text-sm text-mute-soft hover:text-fg">
              Close
            </button>
          </div>
          <GuideContent />
          <button onClick={onClose} className="btn-primary mt-6 w-full py-3 text-base">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
