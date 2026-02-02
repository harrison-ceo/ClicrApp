'use server'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function completeOnboarding(formData: FormData) {
    const supabase = await createClient()

    // 1. Get Current User (Must be authenticated to run this)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return redirect('/login')
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
        return redirect('/onboarding?error=Server Configuration Error: Missing Admin Key');
    }

    const businessName = formData.get('businessName') as string
    const venueName = formData.get('venueName') as string

    if (!businessName || !venueName) {
        return redirect('/onboarding?error=Please fill in all fields')
    }

    // 2. Create Business (Admin Write)
    const { data: business, error: bizError } = await supabaseAdmin
        .from('businesses')
        .insert({ name: businessName })
        .select()
        .single()

    if (bizError) {
        console.error("Business Creation Failed", bizError)
        return redirect(`/onboarding?error=Failed to create business: ${bizError.message}`)
    }

    // 3. Create Profile (Admin Write - bypass RLS for now as user might not match policy yet)
    // Use Upsert to handle retries (if profile exists, update it to point to new business)
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: user.id,
            business_id: business.id,
            role: 'OWNER',
            email: user.email,
            full_name: 'Admin User'
        })

    if (profileError) {
        console.error("Profile Creation Failed", profileError)
    }

    // 4. Create Initial Venue (Admin Write)
    const { data: venue, error: venueError } = await supabaseAdmin
        .from('venues')
        .insert({
            business_id: business.id,
            name: venueName,
            total_capacity: 500
        })
        .select()
        .single()

    // 5. Create Default Area (Admin Write)
    if (venue) {
        await supabaseAdmin.from('areas').insert({
            venue_id: venue.id,
            name: 'General Admission',
            capacity: 500
        })
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
