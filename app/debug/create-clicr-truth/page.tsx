
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function CreateClicrTruthPage() {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    // A) Environment / Auth
    const authState = {
        uid: user?.id,
        project_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        has_session: !!user
    };

    if (!user) return <pre className="text-white p-8">No Session</pre>;

    // B) Context Resolver
    // Get Business Membership
    const { data: members, error: memberError } = await supabaseAdmin
        .from('business_members')
        .select('business_id, role, businesses(name)')
        .eq('user_id', user.id);

    // Get Venues to check visibility
    const { data: venues } = await supabaseUser
        .from('venues')
        .select('id, name')
        .limit(5);

    // C) Devices Schema Check (using Admin to inspect structure if possible, or just list one)
    const { data: sampleDevice, error: sampleError } = await supabaseAdmin
        .from('devices')
        .select('*')
        .limit(1);

    const keys = sampleDevice && sampleDevice[0] ? Object.keys(sampleDevice[0]) : 'No devices found to inspect keys';

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono text-xs space-y-8">
            <h1 className="text-2xl font-bold text-red-500 border-b border-red-900 pb-2">CREATE CLICR TRUTH</h1>

            <section>
                <h2 className="text-lg font-bold text-slate-300 mb-2">A) AUTH & ENV</h2>
                <pre className="bg-slate-900 p-4 rounded border border-slate-800">
                    {JSON.stringify(authState, null, 2)}
                </pre>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-300 mb-2">B) CONTEXT</h2>
                <pre className="bg-slate-900 p-4 rounded border border-slate-800">
                    MEMBERSHIP: {JSON.stringify(members, null, 2)}
                    {memberError && <div className="text-red-500 mt-2">Error: {memberError.message}</div>}

                    VISIBLE VENUES (RLS Check): {JSON.stringify(venues, null, 2)}
                </pre>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-300 mb-2">C) SCHEMA SNAPSHOT (Admin)</h2>
                <div className="bg-slate-900 p-4 rounded border border-slate-800">
                    <p className="mb-2 text-slate-500">First row keys (to check for 'status', 'name', 'device_name'):</p>
                    <pre className="text-green-400 warp text-wrap">
                        {JSON.stringify(keys, null, 2)}
                    </pre>
                    {sampleError && <div className="text-red-500 mt-2">Error: {sampleError.message}</div>}
                </div>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-300 mb-2">D) DIAGNOSIS</h2>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li>If 'status' is missing in keys above, we must add it or use correct column.</li>
                    <li>If 'name' is missing, check 'device_name'.</li>
                    <li>If 'direction_mode' is missing, we must add it.</li>
                </ul>
            </section>
        </div>
    );
}
