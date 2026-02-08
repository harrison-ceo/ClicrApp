
import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next')
    const hasSafeNext = !!next && next.startsWith('/') && !next.startsWith('//')
    const fallbackNext = '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()
            const resolved = user
                ? (await import('@/lib/auth-helpers').then((m) => m.resolvePostAuthRoute(user.id)))
                : null
            const target = hasSafeNext ? next! : (resolved ?? fallbackNext)
            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development'
            const base = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)
            return NextResponse.redirect(new URL(target, base))
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
