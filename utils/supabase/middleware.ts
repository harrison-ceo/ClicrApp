
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Create client
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

    // Get user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protect /dashboard and /settings
    // Also protect /clicr if needed, but maybe that's public for kiosk mode? 
    // For now, let's assume everything under (authenticated) is protected implicitly 
    // but we can check pathnames for stronger security.

    const path = request.nextUrl.pathname;

    // 1. If user is NOT logged in and trying to access protected routes -> Redirect to Login
    // Protected paths: /dashboard, /venues, /settings, /banning, /reports
    // OR simply: If it doesn't start with /login, /signup, /auth, /api/public, or static files
    const isProtectedRoute = path.startsWith('/dashboard') ||
        path.startsWith('/venues') ||
        path.startsWith('/banning') ||
        path.startsWith('/reports') ||
        path.startsWith('/settings') ||
        path.startsWith('/onboarding');

    if (!user && isProtectedRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // 2. If user IS logged in and trying to access Login/Signup -> Redirect to Dashboard
    if (user && (path === '/login' || path === '/signup' || path === '/')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
