
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                    });
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname;

    // --- 1. UNAUTHENTICATED USERS ---
    // Protect private routes
    const isProtectedRoute =
        path.startsWith('/dashboard') ||
        path.startsWith('/venues') ||
        path.startsWith('/banning') ||
        path.startsWith('/reports') ||
        path.startsWith('/settings');
    // Note: /onboarding is protected but handled specifically below

    if (!user) {
        if (isProtectedRoute || path === '/onboarding') {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
        // Allow /onboarding/signup, /onboarding/verify-email, /login, /signup, etc.
        return supabaseResponse;
    }

    // --- 2. AUTHENTICATED USERS ---
    if (user) {
        // Allow Debug & API routes always
        if (
            path.startsWith('/api') ||
            path.startsWith('/_next') ||
            path.includes('.') ||
            path.startsWith('/debug')
        ) {
            return supabaseResponse;
        }

        // Check Onboarding Progress
        const { data: progress } = await supabase
            .from('onboarding_progress')
            .select('current_step')
            .eq('user_id', user.id)
            .single();

        const isOnboardingComplete = (progress?.current_step || 0) >= 999;

        // Scenario A: User is fully onboarded
        if (isOnboardingComplete) {
            // Block onboarding & legacy auth routes -> Go to Dashboard
            if (path.startsWith('/onboarding') || path.startsWith('/auth') || path.startsWith('/login') || path === '/signup' || path === '/') {
                const url = request.nextUrl.clone()
                url.pathname = '/dashboard'
                return NextResponse.redirect(url)
            }
        }

        // Scenario B: User is NOT onboarded
        else {
            // Strict Gate: Must be in /onboarding
            if (!path.startsWith('/onboarding')) {
                const url = request.nextUrl.clone()
                url.pathname = '/onboarding'
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
