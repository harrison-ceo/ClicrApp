'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * App-side role: org_owner can create venues/manage org; staff can only access assigned venues/clickers.
 * Matches remote schema: profiles.role (text) and profiles.org_id.
 */
export type AppRole = 'org_owner' | 'staff' | null

/** Resolve DB role (text) to AppRole. Schema uses 'staff' | 'org_owner' | 'venue_owner' | etc. */
function toAppRole(role: string | null): AppRole {
  if (!role) return null
  const r = role.toLowerCase()
  if (r === 'org_owner' || r === 'owner' || r === 'venue_owner' || r === 'manager') return 'org_owner'
  return 'staff'
}

/** Get current user's role from profiles (org_id + role). */
export async function getRoleForUser(userId: string): Promise<AppRole> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return toAppRole(data?.role ?? null)
}

/** Whether user has an org (profiles.org_id set). */
export async function userHasOrg(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle()
  return !!data?.org_id
}

/**
 * Post-login redirect: no org → onboarding (join/create); has org → dashboard.
 * Staff see dashboard with limited access; owners see full.
 */
export async function resolvePostAuthRoute(userId: string): Promise<string> {
  const hasOrg = await userHasOrg(userId)
  if (!hasOrg) return '/onboarding'
  return '/dashboard'
}
