// Cloud sync — snapshot strategy.
//
// The whole AppState travels as one JSON document stored in the user's
// `profiles.state` row (protected by row-level security). This keeps sync
// simple and robust for a single-user-per-account tracker: last-write-wins by
// timestamp, with a bias that never silently drops un-synced local data.
//
// The app stays local-first: everything works offline against localStorage;
// this layer just backs it up and mirrors it across devices when signed in.

import type { AppState, DailyLog, UserSettings } from './types'
import { supabase } from './supabase'
import { recomputeLog } from './storage'

const MTIME_KEY = 'psmf-local-mtime'

/** Last time this device made a local edit (ms since epoch); 0 if unknown. */
export function readLocalMtime(): number {
  try {
    return Number(localStorage.getItem(MTIME_KEY)) || 0
  } catch {
    return 0
  }
}

export function writeLocalMtime(ms: number): void {
  try {
    localStorage.setItem(MTIME_KEY, String(ms))
  } catch {
    /* ignore */
  }
}

/** A state with no real user data yet — safe to overwrite from the cloud. */
export function isPristine(s: AppState): boolean {
  return !s.seeded && Object.keys(s.logs).length === 0 && s.customFoods.length === 0
}

/** Remove device-only secrets before the state ever leaves the device. */
export function stripSecrets(s: AppState): AppState {
  if (!s.settings.aiApiKey) return s
  const { aiApiKey: _omit, ...settings } = s.settings
  return { ...s, settings: settings as UserSettings }
}

/** Recompute cached per-day totals so an adopted state is internally consistent. */
function recomputeAll(s: AppState): AppState {
  const logs: Record<string, DailyLog> = {}
  for (const [d, log] of Object.entries(s.logs)) logs[d] = recomputeLog(log, s.settings)
  return { ...s, logs }
}

/** Adopt a remote state, but keep this device's local (never-synced) AI key. */
export function adoptRemote(remote: AppState, local: AppState): AppState {
  return recomputeAll({
    ...remote,
    settings: { ...remote.settings, aiApiKey: local.settings.aiApiKey },
  })
}

export interface RemoteSnapshot {
  state: AppState
  updatedAt: number
}

/** Read the signed-in user's snapshot, or null if there isn't a real one yet. */
export async function fetchRemote(): Promise<RemoteSnapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('state, updated_at')
    .maybeSingle()
  if (error) throw error
  if (!data || !data.state) return null
  return {
    state: data.state as AppState,
    updatedAt: Date.parse(data.updated_at as string) || 0,
  }
}

/** Write the local snapshot up to the cloud (secrets stripped). */
export async function pushRemote(state: AppState): Promise<void> {
  if (!supabase) return
  const { data: userRes } = await supabase.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) return
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, state: stripSecrets(state) })
  if (error) throw error
}

export interface ReconcileInput {
  remote: RemoteSnapshot | null
  local: AppState
  localMtime: number
}

export interface ReconcileResult {
  /** State to apply locally. */
  next: AppState
  /** Whether `next` differs from local (i.e. we adopted the remote copy). */
  changed: boolean
  /** Whether `next` should be pushed up to the cloud. */
  push: boolean
  /** Local mtime to record after this decision. */
  mtime: number
}

/**
 * Decide what to keep when a device signs in and finds a cloud snapshot.
 * Pure — no I/O — so the policy is easy to reason about and test.
 */
export function reconcile({ remote, local, localMtime }: ReconcileInput): ReconcileResult {
  const now = Date.now()

  // 1. No usable cloud copy → local is the source of truth; back it up.
  if (!remote || isPristine(remote.state)) {
    return { next: local, changed: false, push: true, mtime: localMtime || now }
  }

  // 2. Cloud has real data and this device is empty → adopt the cloud copy.
  if (isPristine(local)) {
    return { next: adoptRemote(remote.state, local), changed: true, push: false, mtime: remote.updatedAt }
  }

  // 3. Both have real data → last write wins by timestamp. An unknown local
  //    mtime (data from before sync existed) counts as "local wins" so we never
  //    silently overwrite a device's own un-synced history.
  const localWins = localMtime === 0 || localMtime > remote.updatedAt
  if (localWins) {
    return { next: local, changed: false, push: true, mtime: localMtime || now }
  }
  return { next: adoptRemote(remote.state, local), changed: true, push: false, mtime: remote.updatedAt }
}
