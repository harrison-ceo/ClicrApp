'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { METRICS } from '@/lib/core/metrics';
import { getTodayWindow } from '@/lib/core/time';
import { createClient } from '@/utils/supabase/client';

export default function RuntimeInspector() {
    const { business, venues, currentUser, areas } = useApp();
    const [truthA, setTruthA] = useState<any>(null);
    const [truthB, setTruthB] = useState<any>(null);
    const [truthC, setTruthC] = useState<any>(null);
    const [deployResult, setDeployResult] = useState<any>(null);

    // --- TRUTH CARD LOGIC ---

    const loadTruthCardA = async () => {
        const sb = createClient();
        if (!business?.id) return;

        // 1. Fetch Last 50 Events
        const { data: events, error } = await sb
            .from('occupancy_events')
            .select('id, created_at, delta, business_id, venue_id, area_id, source, device_id')
            .eq('business_id', business.id)
            .order('created_at', { ascending: false })
            .limit(50);

        // 2. Fetch Counts (Biz Level)
        const w = getTodayWindow();
        const { count: bizCount } = await sb
            .from('occupancy_events')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', business.id)
            .gte('created_at', w.start)
            .lte('created_at', w.end);

        setTruthA({
            events: events || [],
            error: error?.message,
            bizCount,
            lastRefreshed: new Date().toISOString()
        });
    };

    const loadTruthCardB = async () => {
        if (!business?.id) return;
        const w = getTodayWindow();

        try {
            const result = await METRICS.getTotals(business.id, {}, w);
            setTruthB({
                params: w,
                result: result,
                error: null
            });
        } catch (e) {
            setTruthB({ error: (e as Error).message });
        }
    };

    const loadTruthCardC = async () => {
        if (!business?.id) return;
        const sb = createClient();

        // 1. Raw Areas
        // Fix: Use venues connected to business to filter areas, as we might not have area.business_id
        const venueIds = venues.map(v => v.id);
        const { data: rawAreas, error: areaErr } = await sb
            .from('areas')
            .select('*')
            .in('venue_id', venueIds)
            .limit(10);

        // 2. Raw Snapshots
        const { data: rawSnaps, error: snapErr } = await sb
            .from('occupancy_snapshots')
            .select('*')
            .eq('business_id', business.id)
            .limit(10);

        setTruthC({
            areas: { count: rawAreas?.length, sample: rawAreas?.slice(0, 5), error: areaErr?.message },
            snapshots: { count: rawSnaps?.length, sample: rawSnaps?.slice(0, 5), error: snapErr?.message },
            rlsSuspicion: (rawAreas?.length === 0 && !areaErr) || (rawSnaps?.length === 0 && !snapErr)
        });
    };

    const deployFixes = async () => {
        setDeployResult({ loading: true });
        try {
            const res = await fetch('/api/admin/deploy-rpc');
            const json = await res.json();
            setDeployResult(json);
        } catch (e) {
            setDeployResult({ error: (e as Error).message });
        }
    };

    return (
        <div className="space-y-8 text-sm text-slate-200">
            {/* ADMIN CONTROLS */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">🕵️‍♂️ DEBUGGING CONSOLE</h2>
                <div className="flex gap-2">
                    <button onClick={deployFixes} className="bg-red-900 border border-red-700 text-red-100 px-3 py-1 rounded hover:bg-red-800">
                        {deployResult?.loading ? 'Deploying...' : '⚠️ RE-DEPLOY RPC/RLS'}
                    </button>
                </div>
            </div>

            {deployResult && (
                <div className="bg-slate-900 p-4 rounded border border-slate-700 font-mono text-xs">
                    <div className={deployResult.success ? "text-emerald-400" : "text-red-400"}>
                        {deployResult.success ? "DEPLOY SUCCESS" : "DEPLOY FAILED: " + deployResult.error}
                    </div>
                    {deployResult.manual_sql && (
                        <div className="mt-2 text-amber-500 select-all whitespace-pre-wrap">
                            {deployResult.manual_sql}
                        </div>
                    )}
                </div>
            )}

            {/* TRUTH CARD A: DB EVENTS */}
            <section className="bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">TRUTH CARD A — DB EVENT TRUTH</h3>
                    <button onClick={loadTruthCardA} className="bg-indigo-600 px-3 py-1 rounded text-white text-xs">REFRESH</button>
                </div>
                <div className="p-4 font-mono text-xs">
                    {truthA ? (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-slate-900 p-2 rounded">
                                    <div className="text-slate-500">Business Events Today:</div>
                                    <div className="text-2xl font-bold text-white">{truthA.bizCount ?? 'Loading...'}</div>
                                </div>
                                <div className="bg-slate-900 p-2 rounded">
                                    <div className="text-slate-500">Last Refreshed:</div>
                                    <div className="text-emerald-400">{new Date(truthA.lastRefreshed).toLocaleTimeString()}</div>
                                </div>
                            </div>

                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 border-b border-slate-800">
                                        <th className="py-1">Created At</th>
                                        <th>Delta</th>
                                        <th>Area ID</th>
                                        <th>Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {truthA.events?.map((e: any) => (
                                        <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-900 transition-colors">
                                            <td className="py-1 text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</td>
                                            <td className={e.delta > 0 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                                                {e.delta > 0 ? `+${e.delta}` : e.delta}
                                            </td>
                                            <td className="text-slate-600" title={e.area_id}>{e.area_id?.slice(0, 6)}...</td>
                                            <td className="text-slate-500">{e.source}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {truthA.error && <div className="text-red-500 mt-2">Error: {truthA.error}</div>}
                        </>
                    ) : (
                        <div className="text-slate-500 italic">Click Refresh to load DB Truth...</div>
                    )}
                </div>
            </section>

            {/* TRUTH CARD B: RPC TOTALS */}
            <section className="bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">TRUTH CARD B — TOTALS TRUTH (RPC V3)</h3>
                    <button onClick={loadTruthCardB} className="bg-indigo-600 px-3 py-1 rounded text-white text-xs">REFRESH</button>
                </div>
                <div className="p-4 font-mono text-xs">
                    {truthB ? (
                        <>
                            <div className="mb-4 bg-slate-900 p-2 rounded text-slate-400">
                                <div><strong className="text-slate-300">RPC:</strong> get_traffic_totals_v3</div>
                                <div><strong className="text-slate-300">Start:</strong> {truthB.params.p_start_ts}</div>
                                <div><strong className="text-slate-300">End:</strong> {truthB.params.p_end_ts}</div>
                            </div>

                            {truthB.result ? (
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <div className="bg-emerald-900/20 p-2 rounded border border-emerald-900">
                                        <div className="text-slate-500">Total In</div>
                                        <div className="text-2xl font-bold text-emerald-400">{truthB.result.total_in}</div>
                                    </div>
                                    <div className="bg-amber-900/20 p-2 rounded border border-amber-900">
                                        <div className="text-slate-500">Total Out</div>
                                        <div className="text-2xl font-bold text-amber-400">{truthB.result.total_out}</div>
                                    </div>
                                    <div className="bg-blue-900/20 p-2 rounded border border-blue-900">
                                        <div className="text-slate-500">Net Delta</div>
                                        <div className="text-2xl font-bold text-blue-400">{truthB.result.net_delta}</div>
                                    </div>
                                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <div className="text-slate-500">Events</div>
                                        <div className="text-xl font-bold text-white">{truthB.result.event_count}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-amber-500">RPC returned NO rows (NULL result).</div>
                            )}

                            {truthB.error && <div className="text-red-500 mt-2 font-bold">RPC Error: {truthB.error}</div>}
                        </>
                    ) : (
                        <div className="text-slate-500 italic">Click Refresh to test RPC...</div>
                    )}
                </div>
            </section>

            {/* TRUTH CARD C: AREAS & SNAPSHOTS */}
            <section className="bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">TRUTH CARD C — AREAS TAB TRUTH</h3>
                    <button onClick={loadTruthCardC} className="bg-indigo-600 px-3 py-1 rounded text-white text-xs">REFRESH</button>
                </div>
                <div className="p-4 font-mono text-xs">
                    {truthC ? (
                        <>
                            {truthC.rlsSuspicion && (
                                <div className="bg-red-950/50 border border-red-500 text-red-200 p-2 mb-4 rounded font-bold">
                                    ⚠️ RLS SUSPICION: Queries returned 0 rows but no error. Check Policies!
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-indigo-400 font-bold mb-2">Areas Table ({truthC.areas.count})</h4>
                                    {truthC.areas.error ? (
                                        <div className="text-red-500">{truthC.areas.error}</div>
                                    ) : (
                                        <pre className="bg-black p-2 rounded h-40 overflow-auto text-[10px] text-slate-400">
                                            {JSON.stringify(truthC.areas.sample, null, 2)}
                                        </pre>
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-indigo-400 font-bold mb-2">Snapshots Table ({truthC.snapshots.count})</h4>
                                    {truthC.snapshots.error ? (
                                        <div className="text-red-500">{truthC.snapshots.error}</div>
                                    ) : (
                                        <pre className="bg-black p-2 rounded h-40 overflow-auto text-[10px] text-slate-400">
                                            {JSON.stringify(truthC.snapshots.sample, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-slate-500 italic">Click Refresh to inspect Areas...</div>
                    )}
                </div>
            </section>
        </div>
    );
}
