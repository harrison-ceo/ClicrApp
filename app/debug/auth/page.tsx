
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function AuthDebugPage() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    let businessMembers: any[] = [];
    let onboardingProgress: any = null;
    let business: any = null;
    let appErrors: any[] = [];
    let rlsWarning = false;

    if (user) {
        const { data: members, error: memError } = await supabase.from('business_members').select('*').eq('user_id', user.id);
        businessMembers = members || [];
        if (memError) appErrors.push({ source: 'business_members', error: memError });

        const { data: progress, error: progError } = await supabase.from('onboarding_progress').select('*').eq('user_id', user.id).single();
        onboardingProgress = progress;
        if (progError) appErrors.push({ source: 'onboarding_progress', error: progError });

        if (progress?.business_id) {
            const { data: biz, error: bizError } = await supabase.from('businesses').select('*').eq('id', progress.business_id).single();
            business = biz;
            if (bizError) appErrors.push({ source: 'businesses', error: bizError });
        }

        const { data: errors } = await supabase.from('app_errors').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
        if (errors) appErrors.push(...errors);

        // Heuristic for RLS failure
        if (businessMembers.length === 0 && onboardingProgress?.business_id) {
            rlsWarning = true;
        }
    }

    const debugState = {
        env: {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        },
        user: user ? {
            id: user.id,
            email: user.email,
            role: user.role
        } : null,
        session: !!user,
        businessMembers,
        onboardingProgress,
        business,
        rlsWarning
    };

    return (
        <div className="min-h-screen bg-black text-green-400 p-8 font-mono text-xs">
            <h1 className="text-xl font-bold mb-4 text-white">/debug/auth TRUTH</h1>

            <div className="grid grid-cols-2 gap-4">
                <div className="border border-green-900 p-4">
                    <h2 className="text-white mb-2 uppercase">1. Environment & Auth</h2>
                    <pre>{JSON.stringify(debugState.env, null, 2)}</pre>
                    <div className="mt-4">
                        {user ? (
                            <div className="text-green-500">Authenticated: {user.email}</div>
                        ) : (
                            <div className="text-red-500">Not Authenticated</div>
                        )}
                        {authError && <div className="text-red-500 mt-2">Auth Error: {authError.message}</div>}
                    </div>
                </div>

                <div className="border border-green-900 p-4">
                    <h2 className="text-white mb-2 uppercase">2. Onboarding State</h2>
                    <pre>{JSON.stringify(onboardingProgress, null, 2)}</pre>
                    {onboardingProgress?.completed && <div className="text-blue-400 mt-2">COMPLETED</div>}
                </div>

                <div className="border border-green-900 p-4">
                    <h2 className="text-white mb-2 uppercase">3. Business Config</h2>
                    <div className="mb-2">Memberships: {businessMembers.length}</div>
                    <pre>{JSON.stringify(businessMembers, null, 2)}</pre>
                    <div className="mt-4">Active Business:</div>
                    <pre>{JSON.stringify(business, null, 2)}</pre>
                    {rlsWarning && <div className="text-red-500 font-bold mt-4 animate-pulse">RLS OR LINKAGE ERROR: Progres has business_id but User has no membership!</div>}
                </div>

                <div className="border border-green-900 p-4">
                    <h2 className="text-white mb-2 uppercase">4. Recent Errors</h2>
                    <pre>{JSON.stringify(appErrors, null, 2)}</pre>
                </div>
            </div>
        </div>
    )
}
