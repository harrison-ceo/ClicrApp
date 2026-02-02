'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function completeOnboarding(formData: FormData) {
    const supabase = await createClient()

    // 1. Get Current User (Must be authenticated to run this)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return redirect('/login')
    }

    const businessName = formData.get('businessName') as string
    const venueName = formData.get('venueName') as string

    if (!businessName || !venueName) {
        return redirect('/onboarding?error=Please fill in all fields')
    }

    // 2. Create Business
    const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({ name: businessName })
        .select()
        .single()

    if (bizError) {
        console.error("Business Creation Failed", bizError)
        return // Handle error
    }

    // 3. Create Profile (Link User to Business)
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            business_id: business.id,
            role: 'OWNER',
            email: user.email,
            full_name: 'Admin User' // Could add field for this
        })

    if (profileError) {
        console.error("Profile Creation Failed", profileError)
        // Rollback business? For now, ignore.
    }

    // 4. Create Initial Venue
    const { data: venue, error: venueError } = await supabase
        .from('venues')
        .insert({
            business_id: business.id,
            name: venueName,
            total_capacity: 500
        })
        .select()
        .single()

    // 5. Create Default Area (General Admission)
    if (venue) {
        await supabase.from('areas').insert({
            venue_id: venue.id,
            name: 'General Admission',
            capacity: 500
        })
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
