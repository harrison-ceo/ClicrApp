'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        redirect('/login?error=Invalid login credentials')
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    console.log(`[Auth] Attempting signup for ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            // Redirect to callback to handle session exchange
            emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
        }
    })

    if (error) {
        console.error("[Auth] Signup Error:", error.message);
        redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    if (data.user) {
        // Create Profile immediately ensuring "Link" exists
        // We use Admin client to bypass RLS/Trigger issues
        await supabaseAdmin.from('profiles').upsert({
            id: data.user.id,
            email: email,
            role: 'OWNER', // Default to Owner for new signups
            // business_id is NULL initially, will be set in Onboarding
        })
    }

    if (data.user && !data.session) {
        console.log("[Auth] Signup successful but email verification required.");
        return redirect('/login?message=Check your email to confirm your account.');
    }

    console.log("[Auth] Signup successful, session active. Redirecting to Onboarding.");
    revalidatePath('/', 'layout')
    redirect('/onboarding')
}
