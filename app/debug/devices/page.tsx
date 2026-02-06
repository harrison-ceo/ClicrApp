
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function DevicesDebugPage() {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    // 1. Auth & Context
    const authTruth = {
        userId: user?.id || 'No Session',
        email: user?.email,
    };

    if (!user) return <pre className="text-white p-8">No Session.</pre>;

    // 2. Devices (User Client - check RLS)
    const { data: userDevices, error: userError } = await supabaseUser
        .from('devices')
        .select('*');

    // 3. Devices (Admin Client)
    const { data: adminDevices } = await supabaseAdmin
        .from('devices')
        .select('*')
        // Filter by user's business if we can find it, to be cleaner
        // But listing all is fine for debug
        .limit(10);

    // 4. Check Business Membership (needed for RLS)
    const { data: membership } = await supabaseAdmin
        .from('business_members')
        .select('business_id, role')
        .eq('user_id', user.id);

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono text-sm space-y-8">
            <h1 className="text-2xl font-bold text-yellow-500 border-b border-yellow-900 pb-2">DEVICES TRUTH</h1>

            <Section title="A) Auth & Context">
                <JsonDisplay data={{ ...authTruth, membership }} />
            </Section>

            <Section title="B) Devices Table (Permission Check)">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900 rounded border border-slate-700">
                        <h3 className="font-bold text-blue-400 mb-2">USER CLIENT (RLS Applied)</h3>
                        <p className="mb-2">Count: {userDevices?.length ?? 0}</p>
                        {userError && <p className="text-red-400">Error: {userError.message}</p>}
                        <JsonDisplay data={userDevices} />
                    </div>
                    <div className="p-4 bg-slate-900 rounded border border-slate-700">
                        <h3 className="font-bold text-green-400 mb-2">ADMIN CLIENT (Raw DB)</h3>
                        <p className="mb-2">Count: {adminDevices?.length ?? 0}</p>
                        <JsonDisplay data={adminDevices} />
                    </div>
                </div>
            </Section>

            <Section title="C) Create Simulation (Client Insert Test)">
                <div className="p-4 bg-slate-900 rounded border border-slate-700">
                    <p className="text-slate-400 italic">
                        To test creation, please use the UI. This panel verifies that you CAN read devices.
                        If "User Client" shows devices, RLS SELECT is working.
                        If "User Client" returns [], but Admin has data, RLS is blocking.
                    </p>
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
        <pre className="bg-black/50 p-2 rounded overflow-auto border border-white/5 text-xs text-slate-400 max-h-[300px]">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}

