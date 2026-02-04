import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

export default async function DebugPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="p-10 font-mono">
                <h1 className="text-xl font-bold mb-4">Debug: Not Authenticated</h1>
                <Link href="/login" className="text-blue-500 underline">Go to Login</Link>
            </div>
        );
    }

    // 1. Profile Check
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // 2. Membership Check
    // We use .maybeSingle() equivalent logic or simple array check to avoid 406 if table doesn't exist yet (though it will error)
    const { data: memberships, error: memberError } = await supabase.from('business_members').select('*, businesses(*)').eq('user_id', user.id);

    // 3. Env Check
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Extract project ref (e.g. https://xyz.supabase.co -> xyz)
    const projectRef = envUrl?.replace('https://', '').split('.')[0];

    return (
        <div className="min-h-screen bg-slate-50 p-10 font-mono text-sm text-slate-800">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900">Diagnostics Panel</h1>
                    <Link href="/dashboard" className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Try Dashboard</Link>
                </div>

                <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">1. Environment & Build</h2>
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                        <div className="text-slate-500">Build SHA:</div>
                        <div className="font-mono font-bold">{process.env.NEXT_PUBLIC_GIT_SHA || 'UNKNOWN'}</div>
                        <div className="text-slate-500">Build Time:</div>
                        <div>{process.env.NEXT_PUBLIC_BUILD_TIME || 'UNKNOWN'}</div>
                        <div className="text-slate-500">URL:</div>
                        <div className="font-bold break-all">{envUrl}</div>
                        <div className="text-slate-500">Project Ref:</div>
                        <div className="font-bold text-blue-600">{projectRef}</div>
                        <div className="text-slate-500">Service Role:</div>
                        <div>{process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Present' : '❌ Missing'}</div>
                    </div>
                </section>

                <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">2. Authenticated User</h2>
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                        <div className="text-slate-500">User ID:</div>
                        <div className="font-bold break-all">{user.id}</div>
                        <div className="text-slate-500">Email:</div>
                        <div>{user.email}</div>
                        <div className="text-slate-500">Last Sign In:</div>
                        <div>{user.last_sign_in_at}</div>
                    </div>
                </section>

                <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">3. Business Memberships</h2>
                    {memberError ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded border border-red-100">
                            <strong>Query Error:</strong> {memberError.message}
                            <p className="mt-2 text-xs">If code is &quot;42P01&quot; (undefined table), you must run the migration 09_fix_auth_architecture.sql</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-xs text-slate-500 uppercase tracking-widest">Rows Found: {memberships?.length || 0}</div>
                            {memberships?.map((m, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded border border-slate-100">
                                    <div><strong>Business ID:</strong> {m.business_id}</div>
                                    <div><strong>Role:</strong> {m.role}</div>
                                    <div><strong>Default:</strong> {m.is_default ? 'YES' : 'NO'}</div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        Linked Business: {m.businesses ? (m.businesses as { name: string }).name : 'NULL'}
                                        (Onboarded At: {(m.businesses as { onboarding_completed_at: string } | null)?.onboarding_completed_at || 'NULL'})
                                    </div>
                                </div>
                            ))}
                            {(!memberships || memberships.length === 0) && (
                                <div className="text-amber-600">No memberships found. The app will redirect this user to onboarding.</div>
                            )}
                        </div>
                    )}
                </section>

                <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 opacity-75">
                    <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">4. Legacy Profile (Fallback)</h2>
                    {profileError ? (
                        <div className="text-red-500">Error: {profileError.message}</div>
                    ) : (
                        <pre className="text-xs overflow-auto bg-slate-50 p-2 rounded">{JSON.stringify(profile, null, 2)}</pre>
                    )}
                </section>
            </div>
        </div>
    )
}
