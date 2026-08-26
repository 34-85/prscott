import { useState } from 'react'
import { DISCLAIMER_PARAGRAPHS, acceptDisclaimer } from '../lib/disclaimer'

/** The disclaimer text block, reused by the tab, the gate, and Settings. */
export function DisclaimerBody({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {DISCLAIMER_PARAGRAPHS.map((p, i) => (
        <p key={i} className="text-[13px] leading-relaxed text-mute">
          {p}
        </p>
      ))}
    </div>
  )
}

/** Small shield glyph used on the tab and headers. */
function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

/** Full-screen "Safety" tab content. */
export function DisclaimerScreen() {
  return (
    <div className="space-y-4 pb-24 pt-1">
      <div className="flex items-center gap-2">
        <ShieldIcon className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-bold tracking-tight">Health &amp; Safety</h1>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-mute">Medical disclaimer</h2>
        <DisclaimerBody />
      </div>

      <div className="card border-warn/40 bg-warn/5 p-4">
        <p className="text-[12px] leading-relaxed text-mute">
          If you feel unwell — lightheaded, faint, unusually fatigued, or notice a rapid or
          irregular heartbeat — stop and contact your physician. In an emergency, call your local
          emergency number.
        </p>
      </div>
    </div>
  )
}

/**
 * First-run consent gate. Renders a full-screen overlay with the disclaimer and
 * a required checkbox; on accept it persists the acknowledgment and calls
 * onAccept so the app becomes usable. Shown once per disclaimer version.
 */
export function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  function accept() {
    if (!checked) return
    acceptDisclaimer()
    onAccept()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="relative max-h-[92vh] w-full overflow-y-auto sm:max-w-lg">
        <div
          className="rounded-t-3xl border border-ink-line bg-ink-card p-5 sm:rounded-3xl"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-line sm:hidden" />

          <div className="flex items-center gap-2">
            <ShieldIcon className="h-6 w-6 text-accent" />
            <h2 className="text-lg font-semibold">Before you start</h2>
          </div>

          <div className="mt-4">
            <DisclaimerBody />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-ink-soft/50 p-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#4ea1ff]"
            />
            <span className="text-[13px] leading-snug text-fg">
              I understand this app is not medical advice, and I agree to use it only in conjunction
              with a medical professional.
            </span>
          </label>

          <button
            onClick={accept}
            disabled={!checked}
            className="btn-primary mt-4 w-full py-3 text-base disabled:opacity-40"
          >
            I Understand &amp; Continue
          </button>
        </div>
      </div>
    </div>
  )
}
