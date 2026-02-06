import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null
function getAdmin(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? 'placeholder-key-for-build'
  _admin = createClient(url, key, { auth: { persistSession: false } })
  return _admin
}
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getAdmin() as Record<string, unknown>)[prop as string]
  },
})
