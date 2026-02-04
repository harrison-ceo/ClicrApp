'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { nestFetch, isUsingNest } from '@/lib/api/server'

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

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { resolvePostAuthRoute } = await import('@/lib/auth-helpers');
        const nextPath = await resolvePostAuthRoute(user.id);
        revalidatePath('/', 'layout');
        redirect(nextPath);
    } else {
        redirect('/login?error=Session creation failed');
    }
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
            emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/auth/callback`,
        }
    })

    if (error) {
        console.error("[Auth] Signup Error:", error.message);
        redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    if (data.user && isUsingNest()) {
        try {
            const res = await nestFetch('/api/auth/upsert-profile', {
                method: 'POST',
                body: {
                    id: data.user.id,
                    email,
                    role: 'OWNER',
                },
            });
            if (!res.ok) {
                const text = await res.text();
                console.error('[Auth] Nest profile upsert failed:', res.status, text || '(empty body)');
            }
        } catch (e) {
            console.error('[Auth] Nest profile upsert failed:', e);
        }
    }

    if (data.user && !data.session) {
        console.log("[Auth] Signup successful but email verification required.");
        return redirect('/login?message=Check your email to confirm your account.');
    }

    console.log("[Auth] Signup successful, session active. Redirecting to Onboarding.");
    revalidatePath('/', 'layout')
    redirect('/onboarding')
}
