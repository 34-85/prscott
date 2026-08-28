import { useEffect, useState } from 'react'
import { useStore } from '../app/store'
import { useAuth } from '../app/auth'
import { DisclaimerBody } from './Disclaimer'
import { GuideTour } from './Guide'
import { acceptDisclaimer } from '../lib/disclaimer'
import { setOnboarded } from '../lib/onboarding'

type Step = 'name' | 'disclaimer' | 'signin' | 'checking' | 'setup' | 'tips'

const ORDER: Step[] = ['name', 'disclaimer', 'signin', 'setup', 'tips']

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

/**
 * First-run onboarding: welcome + name → health disclaimer → required sign-in
 * → goal setup → "how it works" tour. Shown once; calls onDone when finished.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { state, updateSettings } = useStore()
  const auth = useAuth()
  const cloud = auth.status !== 'disabled'

  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState(state.settings.userName ?? '')
  const [agreed, setAgreed] = useState(false)

  // sign-in
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState<string | null>(null)

  // setup
  const [startW, setStartW] = useState(String(state.settings.startingWeight))
  const [goal, setGoal] = useState(String(state.settings.goalLoss))
  const [weeks, setWeeks] = useState(String(state.settings.targetWeeks))

  // Keep setup inputs current if settings arrive from the cloud mid-flow.
  useEffect(() => {
    setStartW(String(state.settings.startingWeight))
    setGoal(String(state.settings.goalLoss))
    setWeeks(String(state.settings.targetWeeks))
  }, [state.settings.startingWeight, state.settings.goalLoss, state.settings.targetWeeks])

  // The moment auth reports signed in, move off the sign-in step.
  useEffect(() => {
    if (step === 'signin' && auth.status === 'signedIn') setStep('checking')
  }, [step, auth.status])

  // After sign-in, give sync a beat (so any synced goals prefill), then continue.
  useEffect(() => {
    if (step !== 'checking') return
    const t = setTimeout(() => setStep('setup'), 1500)
    return () => clearTimeout(t)
  }, [step])

  function afterDisclaimer() {
    // The acknowledgment is persisted at finish() so a mid-flow refresh restarts
    // cleanly rather than being treated as an already-onboarded user.
    if (cloud && auth.status !== 'signedIn') setStep('signin')
    else if (cloud) setStep('checking')
    else setStep('setup')
  }

  async function onSend() {
    const e = email.trim()
    if (!e) return
    setBusy(true)
    setAuthMsg(null)
    const err = await auth.sendCode(e)
    setBusy(false)
    if (err) return setAuthMsg(err)
    setSent(true)
    setAuthMsg(`We emailed a sign-in code to ${e}.`)
  }

  async function onVerify() {
    const c = code.trim()
    if (!c) return
    setBusy(true)
    setAuthMsg(null)
    const err = await auth.verifyCode(email.trim(), c)
    setBusy(false)
    if (err) setAuthMsg(err) // success auto-advances via the auth listener
  }

  function finishSetup() {
    const n = (s: string, fallback: number) => {
      const v = parseFloat(s)
      return isNaN(v) ? fallback : v
    }
    updateSettings({
      startingWeight: n(startW, state.settings.startingWeight),
      goalLoss: n(goal, state.settings.goalLoss),
      targetWeeks: Math.max(1, Math.round(n(weeks, state.settings.targetWeeks))),
    })
    setStep('tips')
  }

  function finish() {
    acceptDisclaimer()
    setOnboarded()
    onDone()
  }

  const dotIndex = ORDER.indexOf(step === 'checking' ? 'signin' : step)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="relative max-h-[94vh] w-full overflow-y-auto overscroll-contain sm:max-w-lg">
        <div
          className="rounded-t-3xl border border-ink-line bg-ink-card p-5 sm:rounded-3xl"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-line sm:hidden" />

          {/* progress dots — hidden during the tour, which has its own */}
          {step !== 'tips' && (
            <div className="mb-5 flex justify-center gap-1.5">
              {ORDER.map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    i === dotIndex ? 'w-5 bg-accent' : i < dotIndex ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-ink-line'
                  }`}
                />
              ))}
            </div>
          )}

          {step === 'name' && (
            <div>
              <h2 className="text-xl font-bold tracking-tight">Welcome to PSMF Tracker</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-mute">
                A calm, private dashboard for your protein-sparing modified fast. First, what should
                we call you?
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (name.trim()) {
                    updateSettings({ userName: name.trim() })
                    setStep('disclaimer')
                  }
                }}
              >
                <label className="stat-label mt-5 block">First name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  className="field mt-1 w-full text-base"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="btn-primary mt-4 w-full py-3 text-base disabled:opacity-40"
                >
                  Continue
                </button>
              </form>
            </div>
          )}

          {step === 'disclaimer' && (
            <div>
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-6 w-6 text-accent" />
                <h2 className="text-lg font-semibold">
                  {name.trim() ? `${name.trim()}, before you start` : 'Before you start'}
                </h2>
              </div>
              <div className="mt-4">
                <DisclaimerBody />
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-ink-soft/50 p-3">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#4ea1ff]"
                />
                <span className="text-[13px] leading-snug text-fg">
                  I understand this app is not medical advice, and I agree to use it only in
                  conjunction with a medical professional.
                </span>
              </label>
              <button
                onClick={afterDisclaimer}
                disabled={!agreed}
                className="btn-primary mt-4 w-full py-3 text-base disabled:opacity-40"
              >
                I Understand &amp; Continue
              </button>
            </div>
          )}

          {step === 'signin' && (
            <div>
              <h2 className="text-lg font-semibold">Create your account</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-mute">
                Your logs back up to the cloud and sync across your phone and the web. We email you a
                one-time code — no password to remember.
              </p>

              {!sent ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    onSend()
                  }}
                >
                  <label className="stat-label mt-5 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="field mt-1 w-full text-base"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="btn-primary mt-4 w-full py-3 text-base disabled:opacity-40"
                  >
                    {busy ? 'Sending…' : 'Send code'}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    onVerify()
                  }}
                >
                  <label className="stat-label mt-5 block">Code from email</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={12}
                    className="field mt-1 w-full tnum text-base"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={busy || !code.trim()}
                    className="btn-primary mt-4 w-full py-3 text-base disabled:opacity-40"
                  >
                    {busy ? 'Verifying…' : 'Verify & continue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false)
                      setCode('')
                      setAuthMsg(null)
                    }}
                    className="mt-2 w-full text-[12px] font-medium text-accent hover:underline"
                  >
                    Use a different email
                  </button>
                </form>
              )}
              {authMsg && <p className="mt-2 text-[12px] text-mute-soft">{authMsg}</p>}
            </div>
          )}

          {step === 'checking' && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ink-line border-t-accent" />
              <p className="text-[13px] text-mute">Setting up your account…</p>
            </div>
          )}

          {step === 'setup' && (
            <div>
              <h2 className="text-lg font-semibold">Your goal</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-mute">
                A quick baseline so your dashboard and forecast are meaningful. You can change any of
                this later in Settings.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  finishSetup()
                }}
                className="mt-5 space-y-4"
              >
                <label className="block">
                  <span className="stat-label">Starting weight</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="number" step={0.1} value={startW}
                      onChange={(e) => setStartW(e.target.value)}
                      className="field tnum flex-1 text-base" inputMode="decimal" />
                    <span className="text-xs text-mute-soft">lb</span>
                  </div>
                </label>
                <label className="block">
                  <span className="stat-label">Goal to lose</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="number" step={0.5} value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      className="field tnum flex-1 text-base" inputMode="decimal" />
                    <span className="text-xs text-mute-soft">lb</span>
                  </div>
                </label>
                <label className="block">
                  <span className="stat-label">Over how many weeks</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="number" step={1} value={weeks}
                      onChange={(e) => setWeeks(e.target.value)}
                      className="field tnum flex-1 text-base" inputMode="numeric" />
                    <span className="text-xs text-mute-soft">wk</span>
                  </div>
                </label>
                <button type="submit" className="btn-primary w-full py-3 text-base">
                  Continue
                </button>
              </form>
            </div>
          )}

          {step === 'tips' && (
            <div>
              <p className="mb-4 text-[13px] font-medium text-accent">
                {name.trim() ? `You're all set, ${name.trim()} — here's how it works` : "You're all set — here's how it works"}
              </p>
              <GuideTour onDone={finish} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
