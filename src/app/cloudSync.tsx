import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
 * Drives cloud sync for the store. On sign-in it reconciles the local snapshot
 * with the cloud one (last-write-wins); thereafter it debounce-pushes local
 * edits up. A no-op when cloud isn't configured or nobody's signed in.
 *
 * `applyRemote` must be the store's setState so an adopted cloud copy replaces
 * local state. Returns the current SyncState for display.
 */
export function useCloudSync(
  state: AppState,
  applyRemote: (s: AppState) => void,
): SyncState {
  const { status, user } = useAuth()
  const [syncState, setSyncState] = useState<SyncState>('off')

  // Latest state without retriggering the reconcile effect.
  const stateRef = useRef(state)
  stateRef.current = state

  const syncedFor = useRef<string | null>(null) // user id we've reconciled for
  const ready = useRef(false) // true once initial reconcile finished
  const suppressPush = useRef(false) // skip the push for a just-adopted remote copy
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── reconcile once per sign-in ────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'signedIn' || !user) {
      syncedFor.current = null
      ready.current = false
      setSyncState('off')
      return
    }
    if (syncedFor.current === user.id) return
    syncedFor.current = user.id
    ready.current = false
    let cancelled = false

    ;(async () => {
      setSyncState('syncing')
      try {
        const remote = await fetchRemote()
        if (cancelled) return
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
        if (!cancelled) {
          ready.current = true
          setSyncState('synced')
        }
      } catch (e) {
        console.error('Cloud sync failed', e)
        if (!cancelled) {
          setSyncState('error')
          syncedFor.current = null // allow a retry on the next change/sign-in
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, user, applyRemote])

  // ── push local edits (debounced) while signed in ──────────────────────────
  useEffect(() => {
    if (status !== 'signedIn' || !user || syncedFor.current !== user.id) return
    if (!ready.current) return // initial reconcile still in flight
    if (suppressPush.current) {
      suppressPush.current = false // this change was an adopted remote copy
      return
    }
    writeLocalMtime(Date.now())
    setSyncState('syncing')
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      try {
        await pushRemote(stateRef.current)
        setSyncState('synced')
      } catch (e) {
        console.error('Cloud push failed', e)
        setSyncState('error')
      }
    }, 1200)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [state, status, user])

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
