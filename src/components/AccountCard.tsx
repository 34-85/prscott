import { useState } from 'react'
import { useAuth } from '../app/auth'

/**
 * Account card for Settings. Lets the user sign in with an email one-time code
 * so their logs can sync across devices. Renders nothing until a Supabase
 * project is configured (the app stays fully local until then).
 */
export function AccountCard() {
  const { status, email, sendCode, verifyCode, signOut } = useAuth()
  const [addr, setAddr] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Cloud not configured → no account UI at all.
  if (status === 'disabled') return null

  if (status === 'signedIn') {
    return (
      <div className="card p-4">
        <h2 className="mb-1 text-sm font-semibold text-mute">Account</h2>
        <p className="text-[12px] text-mute-soft">
          Signed in as <span className="text-fg">{email}</span>. Your logs sync to
          the cloud and stay available on every device.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="btn-ghost mt-3 px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>
    )
  }

  async function onSend() {
    const e = addr.trim()
    if (!e) return
    setBusy(true)
    setMsg(null)
    const err = await sendCode(e)
    setBusy(false)
    if (err) {
      setMsg(err)
      return
    }
    setSent(true)
    setMsg(`We emailed a 6-digit code to ${e}.`)
  }

  async function onVerify() {
    const c = code.trim()
    if (!c) return
    setBusy(true)
    setMsg(null)
    const err = await verifyCode(addr.trim(), c)
    setBusy(false)
    if (err) {
      setMsg(err)
      return
    }
    // Success flips status to 'signedIn' via the auth listener.
  }

  function reset() {
    setSent(false)
    setCode('')
    setMsg(null)
  }

  return (
    <div className="card p-4">
      <h2 className="mb-1 text-sm font-semibold text-mute">Account</h2>
      <p className="mb-3 text-[12px] leading-relaxed text-mute-soft">
        Sign in to back up your logs and sync them across your iPhone and the web.
        We email you a one-time code — no password to remember.
      </p>

      {!sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSend()
          }}
        >
          <label className="stat-label">Email</label>
          <div className="mt-1 flex gap-2">
            <input
              type="email"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="field flex-1 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !addr.trim()}
              className="btn-primary px-4 text-sm disabled:opacity-40"
            >
              {busy ? '…' : 'Send code'}
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onVerify()
          }}
        >
          <label className="stat-label">6-digit code</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              className="field flex-1 tnum text-sm"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="btn-primary px-4 text-sm disabled:opacity-40"
            >
              {busy ? '…' : 'Verify'}
            </button>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-[12px] font-medium text-accent hover:underline"
          >
            Use a different email
          </button>
        </form>
      )}

      {msg && <p className="mt-2 text-[12px] text-mute-soft">{msg}</p>}
    </div>
  )
}
