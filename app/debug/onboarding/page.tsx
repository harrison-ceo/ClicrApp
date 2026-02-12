
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { headers } from 'next/headers';

export default async function OnboardingDebugPage() {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    // 1. Auth Truth
    const authTruth = {
        userId: user?.id || 'No Session',
        email: user?.email,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        env: process.env.NODE_ENV
    };

    if (!user) {
        return <pre className="text-white p-8">No Authenticated User. Please Login.</pre>;
    }

    // 2. Membership Truth (User Client - Simulates Middleware)
    const { data: userMemberships, error: userMemberError } = await supabaseUser
        .from('business_members')
        .select('*')
        .eq('user_id', user.id);

    // 3. Membership Truth (Admin Client - Absolute Truth)
    const { data: adminMemberships, error: adminMemberError } = await supabaseAdmin
        .from('business_members')
        .select('*')
        .eq('user_id', user.id);

    // 4. Business Truth
    const businessIds = adminMemberships?.map(m => m.business_id) || [];
    const { data: businesses } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .in('id', businessIds);

    // 5. Venue Truth
    const { data: venues } = await supabaseAdmin
        .from('venues')
        .select('id, name, business_id, status')
        .in('business_id', businessIds);

    // 6. Decision Logic
    const middlewareDecision = (userMemberships?.length || 0) > 0;

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono text-sm space-y-8">
            <h1 className="text-2xl font-bold text-red-500 border-b border-red-900 pb-2">CRITICAL ONBOARDING TRUTH</h1>

            <Section title="A) Auth Truth (Environment)">
                <JsonDisplay data={authTruth} />
            </Section>

            <Section title="B) Membership Truth (The Gatekeeper)">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900 rounded border border-slate-700">
                        <h3 className="font-bold text-yellow-400 mb-2">USER CLIENT (Middleware View)</h3>
                        <p className="mb-2">Count: {userMemberships?.length ?? 0}</p>
                        {userMemberError && <p className="text-red-400">Error: {userMemberError.message}</p>}
                        <JsonDisplay data={userMemberships} />
                    </div>
                    <div className="p-4 bg-slate-900 rounded border border-slate-700">
                        <h3 className="font-bold text-green-400 mb-2">ADMIN CLIENT (DB Reality)</h3>
                        <p className="mb-2">Count: {adminMemberships?.length ?? 0}</p>
                        {adminMemberError && <p className="text-red-400">Error: {adminMemberError.message}</p>}
                        <JsonDisplay data={adminMemberships} />
                    </div>
                </div>
                {userMemberships?.length === 0 && adminMemberships?.length > 0 && (
                    <div className="mt-4 p-4 bg-red-900/50 text-red-200 border border-red-500 rounded font-bold">
                        🚨 RLS BLOCKING DETECTED: Data exists but User cannot see it. Middleware thinks user is new.
                    </div>
                )}
            </Section>

            <Section title="C) Business / Venue Chain">
                <div className="space-y-4">
                    <div className="p-4 bg-slate-900 rounded">
                        <h4 className="font-bold text-slate-400">Businesses ({businesses?.length})</h4>
                        <JsonDisplay data={businesses} />
                    </div>
                    <div className="p-4 bg-slate-900 rounded">
                        <h4 className="font-bold text-slate-400">Venues ({venues?.length})</h4>
                        <JsonDisplay data={venues} />
                    </div>
                </div>
            </Section>

            <Section title="D) Middleware Decision Simulator">
                <div className="p-4 border rounded text-lg">
                    Router Decision: <strong className={middlewareDecision ? "text-green-500" : "text-red-500"}>
                        {middlewareDecision ? "GO TO DASHBOARD" : "REDIRECT TO ONBOARDING"}
                    </strong>
                </div>
            </Section>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-lg font-bold text-slate-300 mb-4 uppercase">{title}</h2>
            {children}
        </section>
    );
}

function JsonDisplay({ data }: { data: any }) {
    return (
        <pre className="bg-black/50 p-2 rounded overflow-auto border border-white/5 text-xs text-slate-400">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}
