'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/** Extract invite code from form: raw code or "code" query param from pasted URL */
function parseInviteCode(input: string): string {
  const trimmed = (input || '').trim()
  try {
    const asUrl = trimmed.startsWith('http') ? trimmed : `https://x/?${trimmed}`
    const url = new URL(asUrl)
    const code = url.searchParams.get('code') || url.pathname.replace(/^\/join\/?/, '').replace(/^\//, '') || trimmed
    return code.trim() || trimmed
  } catch {
    return trimmed
  }
}

/** Create org + first venue (org owner path). Uses organizations + venues + profiles. */
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect('/login')

  const businessName = (formData.get('businessName') as string)?.trim()
  const venueName = (formData.get('venueName') as string)?.trim()
  const venueCity = (formData.get('venueCity') as string)?.trim()
  const venueState = (formData.get('venueState') as string)?.trim()
  const venueCapacity = Number(formData.get('venueCapacity')) || 500

  if (!businessName || !venueName) {
    return redirect('/onboarding?error=Please fill in organization and venue name')
  }

  const address = [venueCity, venueState].filter(Boolean).join(', ') || null

  try {
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: businessName, owner_id: user.id })
      .select()
      .single()
    if (orgError) throw new Error(`Organization creation failed: ${orgError.message}`)

    const { data: venue, error: venueError } = await supabaseAdmin
      .from('venues')
      .insert({
        org_id: org.id,
        name: venueName,
        address,
        capacity: venueCapacity,
        owner_id: user.id,
      })
      .select()
      .single()
    if (venueError) throw new Error(`Venue creation failed: ${venueError.message}`)

    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        org_id: org.id,
        venue_id: venue.id,
        role: 'org_owner',
        email: user.email ?? undefined,
        full_name: user.user_metadata?.full_name ?? undefined,
      }, { onConflict: 'id' })

    console.log(`[Onboarding] Org + venue created for user ${user.id} -> org ${org.id}`)
  } catch (err) {
    console.error('[Onboarding] Error:', err)
    return redirect(`/onboarding?error=${encodeURIComponent((err as Error).message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/** Join existing org/venue with invite code (venue owner or venue staff). Code can be venue ID or ?code= from invite URL. */
export async function joinWithInvite(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect('/login')

  const rawCode = (formData.get('inviteCode') as string) || ''
  const role = (formData.get('role') as string) || 'venue_staff'
  const code = parseInviteCode(rawCode)
  if (!code) return redirect('/onboarding?error=Please enter an invite code or paste the invite link')

  try {
    const isUuid = code.length === 36 && /^[0-9a-f-]{36}$/i.test(code)
    if (!isUuid) {
      return redirect('/onboarding?error=Invite code should be the venue ID (UUID) from your org owner. Paste the full invite link or the ID they shared.')
    }

    const { data: venue, error: venueError } = await supabaseAdmin
      .from('venues')
      .select('id, org_id')
      .eq('id', code)
      .single()

    if (venueError || !venue) {
      return redirect('/onboarding?error=Invalid or expired invite code. Ask your org owner for a new link.')
    }

    const { error: staffError } = await supabaseAdmin
      .from('venue_staff')
      .upsert(
        { venue_id: venue.id, user_id: user.id, role: role === 'venue_owner' ? 'venue_owner' : 'staff' },
        { onConflict: 'venue_id,user_id' }
      )
    if (staffError) throw new Error(staffError.message)

    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        org_id: venue.org_id,
        venue_id: venue.id,
        role: role === 'venue_owner' ? 'venue_owner' : 'staff',
        email: user.email ?? undefined,
        full_name: user.user_metadata?.full_name ?? undefined,
      }, { onConflict: 'id' })

    console.log(`[Onboarding] User ${user.id} joined venue ${venue.id} as ${role}`)
  } catch (err) {
    console.error('[Onboarding] Join error:', err)
    return redirect(`/onboarding?error=${encodeURIComponent((err as Error).message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
