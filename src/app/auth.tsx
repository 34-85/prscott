import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isCloudConfigured } from '../lib/supabase'

export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn'

interface AuthApi {
  status: AuthStatus
  user: User | null
  email: string | null
  /** Email a 6-digit sign-in code. Returns an error message, or null on success. */
  sendCode: (email: string) => Promise<string | null>
  /** Verify the 6-digit code. Returns an error message, or null on success. */
  verifyCode: (email: string, code: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isCloudConfigured() ? 'loading' : 'disabled',
  )
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setStatus(data.session ? 'signedIn' : 'signedOut')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setStatus(session ? 'signedIn' : 'signedOut')
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const sendCode = useCallback(async (email: string): Promise<string | null> => {
    if (!supabase) return 'Cloud sync is not configured.'
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    return error ? error.message : null
  }, [])

  const verifyCode = useCallback(
    async (email: string, code: string): Promise<string | null> => {
      if (!supabase) return 'Cloud sync is not configured.'
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      })
      return error ? error.message : null
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{ status, user, email: user?.email ?? null, sendCode, verifyCode, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
