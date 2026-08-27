/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. When unset, cloud sync + accounts are disabled. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon (publishable) key — safe to ship in the client. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
