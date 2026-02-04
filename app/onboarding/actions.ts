'use server'

import { createClient } from '@/utils/supabase/server'
import { nestFetch } from '@/lib/api/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function completeOnboarding(formData: FormData) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return redirect('/login')
    }

    if (!process.env.NEXT_PUBLIC_API_URL) {
        console.error("NEXT_PUBLIC_API_URL is not set. Point it to your Nest backend.");
        return redirect('/onboarding?error=Server Configuration Error');
    }

    const businessName = formData.get('businessName') as string
    const venueName = formData.get('venueName') as string
    const venueCapacity = parseInt(formData.get('venueCapacity') as string) || 500
    const venueTimezone = formData.get('venueTimezone') as string || 'UTC'

    if (!businessName || !venueName) {
        return redirect('/onboarding?error=Please fill in all fields')
    }

    try {
        const res = await nestFetch('/api/onboarding/complete', {
            method: 'POST',
            body: {
                userId: user.id,
                userEmail: user.email ?? '',
                businessName,
                venueName,
                venueCapacity,
                venueTimezone,
            },
        });

        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            const msg = (json as { message?: string }).message ?? res.statusText;
            throw new Error(msg);
        }
        console.log(`[Onboarding] Success for User ${user.id}`);
    } catch (err) {
        console.error("[Onboarding] Error:", err);
        return redirect(`/onboarding?error=${encodeURIComponent((err as Error).message)}`);
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}
