import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppState } from '../lib/types'
import { useAuth } from './auth'
import {
  fetchRemote,
  pushRemote,
  reconcile,
  readLocalMtime,
  writeLocalMtime,
} from '../lib/sync'

export type SyncState = 'off' | 'syncing' | 'synced' | 'error'

const SyncStatusContext = createContext<SyncState>('off')

/** Current cloud-sync status, for a small indicator in the Account card. */
export function useSyncStatus(): SyncState {
  return useContext(SyncStatusContext)
}

/**
 * Drives cloud sync for the store.
 *
 * - On sign-in it reconciles the local snapshot with the cloud one (LWW).
 * - Local edits are pushed up (debounced).
 * - When a tab regains focus it re-pulls, so switching between devices/tabs
 *   shows the latest without a manual reload; when a tab is backgrounded any
 *   pending push is flushed immediately so the other side sees it right away.
 *
 * A no-op when cloud isn't configured or nobody's signed in. `applyRemote` must
 * be the store's setState so an adopted cloud copy replaces local state.
 */
export function useCloudSync(
  state: AppState,
  applyRemote: (s: AppState) => void,
): SyncState {
  const { status, user } = useAuth()
  const [syncState, setSyncState] = useState<SyncState>('off')

  // Latest state, read inside callbacks without adding it as a dependency.
  const stateRef = useRef(state)
  stateRef.current = state

  const syncedFor = useRef<string | null>(null) // user id we've reconciled for
  const ready = useRef(false) // true once the initial reconcile finished
  const reconciling = useRef(false) // guard against overlapping pulls
  const suppressPush = useRef(false) // skip the push for a just-adopted remote copy
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushPending = useRef(false)

  const signedIn = status === 'signedIn' && !!user

  // Push the current local snapshot up now.
  const pushNow = useCallback(async () => {
    pushPending.current = false
    if (pushTimer.current) {
      clearTimeout(pushTimer.current)
      pushTimer.current = null
    }
    try {
      await pushRemote(stateRef.current)
      setSyncState('synced')
    } catch (e) {
      console.error('Cloud push failed', e)
      setSyncState('error')
    }
  }, [])

  // Pull the cloud snapshot and reconcile it with local (LWW). Idempotent;
  // safe to call on sign-in and whenever a tab regains focus.
  const reconcileNow = useCallback(async () => {
    if (!signedIn || reconciling.current) return
    reconciling.current = true
    setSyncState('syncing')
    try {
      const remote = await fetchRemote()
      const r = reconcile({
        remote,
        local: stateRef.current,
        localMtime: readLocalMtime(),
      })
      writeLocalMtime(r.mtime)
      if (r.changed) {
        suppressPush.current = true
        applyRemote(r.next)
      }
      if (r.push) await pushRemote(r.next)
      ready.current = true
      setSyncState('synced')
    } catch (e) {
      console.error('Cloud sync failed', e)
      setSyncState('error')
      syncedFor.current = null // allow a retry on the next change/focus/sign-in
    } finally {
      reconciling.current = false
    }
  }, [signedIn, applyRemote])

  // ── reconcile once per sign-in ────────────────────────────────────────────
  useEffect(() => {
    if (!signedIn || !user) {
      syncedFor.current = null
      ready.current = false
      setSyncState('off')
      return
    }
    if (syncedFor.current === user.id) return
    syncedFor.current = user.id
    ready.current = false
    reconcileNow()
  }, [signedIn, user, reconcileNow])

  // ── re-pull on focus; flush a pending push on background ───────────────────
  useEffect(() => {
    if (!signedIn) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (pushPending.current) pushNow()
      } else if (ready.current) {
        reconcileNow()
      }
    }
    const onFocus = () => {
      if (ready.current) reconcileNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [signedIn, reconcileNow, pushNow])

  // ── push local edits (debounced) while signed in ──────────────────────────
  useEffect(() => {
    if (!signedIn || !user || syncedFor.current !== user.id) return
    if (!ready.current) return // initial reconcile still in flight
    if (suppressPush.current) {
      suppressPush.current = false // this change was an adopted remote copy
      return
    }
    writeLocalMtime(Date.now())
    pushPending.current = true
    setSyncState('syncing')
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(pushNow, 1200)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [state, signedIn, user, pushNow])

  return syncState
}

/** Provides the sync status to descendants (e.g. the Account card). */
export function SyncStatusProvider({
  value,
  children,
}: {
  value: SyncState
  children: ReactNode
}) {
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>
}
