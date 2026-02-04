import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Prefer Nest for all backend work (set NEXT_PUBLIC_API_URL). This client is only used
// by code paths not yet migrated to Nest (e.g. scan, scanner). Use same env names as Nest.
const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_KEY ??
  process.env.SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Supabase admin env missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in .env, or use Nest only (NEXT_PUBLIC_API_URL) and migrate remaining code to Nest.'
    );
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

/** @deprecated Prefer calling Nest backend. Only used by scan/scanner/API routes not yet migrated. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as Record<string, unknown>)[prop as string];
  },
});
