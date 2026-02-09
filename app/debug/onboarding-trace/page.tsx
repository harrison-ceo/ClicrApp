'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function OnboardingTracePage() {
    const [trace, setTrace] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTrace = async () => {
            try {
                const supabase = createClient();
                const session = await supabase.auth.getSession();
                const user = session.data.session?.user;

                if (!user) {
                    setTrace({ auth: 'No Session' });
                    setLoading(false);
                    return;
                }

                const { data: progress, error: progressError } = await supabase
                    .from('onboarding_progress')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                const { data: businessMembers, error: membersError } = await supabase
                    .from('business_members')
                    .select('*, businesses(*)')
                    .eq('user_id', user.id);

                // Check for recent errors
                const { data: errors } = await supabase
                    .from('app_errors')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                setTrace({
                    auth: {
                        uid: user.id,
                        email: user.email,
                        role: user.role
                    },
                    progress: progress || { status: 'Missing', error: progressError },
                    memberships: businessMembers || { error: membersError },
                    recentErrors: errors
                });
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTrace();
    }, []);

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /> Loading Trace...</div>;
    if (error) return <div className="p-8 text-red-500">Failed to load trace: {error}</div>;

    return (
        <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-200 font-mono text-sm">
            <h1 className="text-2xl font-bold text-white">Debugger: Onboarding Trace</h1>

            {/* Auth Block */}
            <Card className="bg-slate-900 border-white/10">
                <CardHeader><CardTitle className="text-white">Auth State</CardTitle></CardHeader>
                <CardContent>
                    <pre>{JSON.stringify(trace.auth, null, 2)}</pre>
                </CardContent>
            </Card>

            {/* Progress Block */}
            <Card className="bg-slate-900 border-white/10">
                <CardHeader><CardTitle className="text-white">Onboarding Progress</CardTitle></CardHeader>
                <CardContent>
                    {trace.progress?.status === 'Missing' ? (
                        <div className="text-red-400 font-bold">NO ONBOARDING PROGRESS FOUND</div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Badge variant={trace.progress.completed ? "default" : "destructive"}>
                                    Completed: {trace.progress.completed ? 'YES' : 'NO'}
                                </Badge>
                                <Badge variant="outline">Step: {trace.progress.current_step}</Badge>
                            </div>
                            <div className="p-2 bg-black rounded border border-white/10">
                                Payload: {JSON.stringify(trace.progress.payload, null, 2)}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Business Context */}
            <Card className="bg-slate-900 border-white/10">
                <CardHeader><CardTitle className="text-white">Business Context</CardTitle></CardHeader>
                <CardContent>
                    {Array.isArray(trace.memberships) && trace.memberships.length === 0 && (
                        <div className="text-yellow-400">No Business Memberships found.</div>
                    )}
                    <pre>{JSON.stringify(trace.memberships, null, 2)}</pre>
                </CardContent>
            </Card>

            {/* Recent Errors */}
            {trace.recentErrors?.length > 0 && (
                <Card className="bg-red-950/20 border-red-500/20">
                    <CardHeader><CardTitle className="text-red-400">Recent Errors Logged</CardTitle></CardHeader>
                    <CardContent>
                        {trace.recentErrors.map((err: any) => (
                            <div key={err.id} className="mb-4 border-b border-red-500/10 pb-2">
                                <div className="font-bold text-red-300">{err.context}</div>
                                <div className="text-xs text-red-400">{err.error_message}</div>
                                <div className="text-[10px] text-slate-500">{new Date(err.created_at).toLocaleString()}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
