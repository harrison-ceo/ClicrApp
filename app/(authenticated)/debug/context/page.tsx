"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useApp } from '@/lib/store';

export default function DebugContextPage() {
    const supabase = createClient();
    const { currentUser, business, venues, areas, devices } = useApp();

    const [debugData, setDebugData] = useState<any>({ loading: true });

    useEffect(() => {
        const fetchTruth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
            const { data: members, error: memError } = await supabase.from('business_members').select('*').eq('user_id', user?.id);

            const businessIds = members?.map(m => m.business_id) || [];

            const { data: businesses } = await supabase.from('businesses').select('*').in('id', businessIds);
            const { count: venueCount } = await supabase.from('venues').select('*', { count: 'exact', head: true }).in('business_id', businessIds);
            const { count: areaCount } = await supabase.from('areas').select('*', { count: 'exact', head: true }).in('business_id', businessIds);
            const { count: devCount } = await supabase.from('devices').select('*', { count: 'exact', head: true }).in('business_id', businessIds);

            setDebugData({
                auth: { uid: user?.id, email: user?.email },
                profile,
                members,
                memError,
                businesses,
                counts: {
                    venues: venueCount,
                    areas: areaCount,
                    devices: devCount
                },
                env: {
                    project: process.env.NEXT_PUBLIC_SUPABASE_URL,
                    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE
                },
                loading: false
            });
        };

        fetchTruth();
    }, []);

    return (
        <div className="p-8 text-white font-mono text-xs space-y-6">
            <h1 className="text-xl font-bold text-red-500">SYSTEM CONTEXT TRUTH</h1>

            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                    <Section title="1. AUTH & PROFILE" data={debugData.auth} />
                    <Section title="2. RAW MEMBERSHIP (DB)" data={{ members: debugData.members, error: debugData.memError }} />
                    <Section title="3. RAW BUSINESSES (DB)" data={debugData.businesses} />
                    <Section title="4. RAW COUNTS (DB)" data={debugData.counts} />
                </div>

                <div className="space-y-4">
                    <Section title="5. APP STATE (MEMORY)" data={{
                        currentUser,
                        business: business?.id,
                        venueCount: venues.length,
                        areaCount: areas.length,
                        deviceCount: devices.length
                    }} />
                    <Section title="6. ENV CONFIG" data={debugData.env} />
                </div>
            </div>
        </div>
    );
}
const Section = ({ title, data }: { title: string, data: any }) => (
    <div className="bg-slate-900 p-4 rounded border border-slate-800">
        <h3 className="text-emerald-400 font-bold mb-2">{title}</h3>
        <pre className="whitespace-pre-wrap text-slate-400">
            {JSON.stringify(data, null, 2)}
        </pre>
    </div>
);

