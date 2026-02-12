
"use client";

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AreasTruthPage() {
    const { areas, venues, business } = useApp();
    const [snapshots, setSnapshots] = useState<any[]>([]);

    useEffect(() => {
        const fetchSnapshots = async () => {
            const supabase = createClient();
            if (business?.id) {
                const { data } = await supabase.from('occupancy_snapshots').select('*').eq('business_id', business.id);
                setSnapshots(data || []);
            }
        };
        fetchSnapshots();
    }, [business?.id]);

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono text-xs">
            <Link href="/dashboard" className="flex items-center gap-2 mb-4 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <h1 className="text-2xl font-bold text-yellow-500 mb-8 border-b border-yellow-900 pb-2">AREAS % FULL TRUTH</h1>

            {!business && <div className="text-red-500">NO BUSINESS CONTEXT</div>}

            <div className="space-y-4">
                {areas.map(area => {
                    const venue = venues.find(v => v.id === area.venue_id);
                    const snap = snapshots.find(s => s.area_id === area.id);
                    const occup = snap?.current_occupancy ?? 0;

                    // Logic Mirror
                    const areaCap = area.capacity_max;
                    const venueCap = venue?.total_capacity || venue?.default_capacity_total;
                    const capUsed = areaCap || venueCap || 0;
                    const pct = capUsed > 0 ? Math.round((occup / capUsed) * 100) : null;

                    return (
                        <div key={area.id} className="bg-slate-900 p-4 rounded border border-slate-800 grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-lg font-bold text-white">{area.name}</div>
                                <div className="text-slate-500">ID: {area.id}</div>
                                <div className="text-slate-500">Venue: {venue?.name} ({venue?.id})</div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Current Occupancy:</span>
                                    <span className="text-emerald-400 font-bold">{occup}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Area Cap (capacity_max):</span>
                                    <span className={areaCap ? "text-blue-400" : "text-slate-600"}>{areaCap ?? 'NULL'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Venue Cap Override:</span>
                                    <span className={venueCap ? "text-blue-400" : "text-slate-600"}>{venueCap ?? 'NULL'}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-800 pt-1 mt-1">
                                    <span className="text-yellow-500 font-bold">CAPACITY USED:</span>
                                    <span className="text-yellow-500 font-bold">{capUsed}</span>
                                </div>
                                <div className="flex justify-between text-lg">
                                    <span className="text-white font-bold">% FULL:</span>
                                    <span className={pct !== null ? "text-green-400 font-bold" : "text-slate-600"}>
                                        {pct !== null ? `${pct}%` : '---'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 bg-slate-900 p-4 border border-slate-800">
                <h2 className="font-bold text-slate-300 mb-2">RAW STORE DATA DUMP</h2>
                <div className="grid grid-cols-2 gap-4">
                    <pre className="text-[10px] text-slate-500 max-h-40 overflow-auto">{JSON.stringify(areas, null, 2)}</pre>
                    <pre className="text-[10px] text-slate-500 max-h-40 overflow-auto">{JSON.stringify(venues, null, 2)}</pre>
                </div>
            </div>
        </div>
    );
}
