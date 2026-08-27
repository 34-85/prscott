// Supabase client. Created only when both env vars are present, so the app
// runs exactly as before (local-only, no accounts) until a project is wired up.
//
// Set these in a local .env.local (gitignored) or your host's env:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...            (the anon/publishable key — safe in the client)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when a Supabase project is configured — gates every cloud feature. */
export function isCloudConfigured(): boolean {
  return Boolean(url && anonKey)
}

/** The Supabase client, or null when cloud isn't configured. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false, // we use one-time codes, not magic links
        },
      })
    : null
