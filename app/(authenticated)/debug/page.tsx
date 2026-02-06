"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
import { RefreshCw, Database, Activity, LayoutDashboard, Terminal, ShieldCheck, AlertTriangle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function DebugPage() {
    const {
        venues, areas, events,
        venueMetrics, areaMetrics,
        debug, refreshState, currentUser, business,
        isLoading, lastError
    } = useApp();

    const [activeTab, setActiveTab] = useState<'UI' | 'TRACE' | 'TRUTH'>('UI');
    const [truthSnapshots, setTruthSnapshots] = useState<any[]>([]);
    const [truthEvents, setTruthEvents] = useState<any[]>([]);
    const [revertLogs, setRevertLogs] = useState<string[]>([]);

    const supabase = createClient();

    // Revert Detector
    const lastAreaOccRef = useRef<Record<string, number>>({});

    useEffect(() => {
        areas.forEach(area => {
            const last = lastAreaOccRef.current[area.id];
            const current = area.current_occupancy || 0;

            // Detect drastic drop to 0 from non-zero
            if (last > 0 && current === 0) {
                const msg = `[${new Date().toISOString()}] REVERT DETECTED: Area ${area.name} (${area.id}) dropped from ${last} to 0`;
                console.warn(msg);
                setRevertLogs(prev => [msg, ...prev]);
            }
            lastAreaOccRef.current[area.id] = current;
        });
    }, [areas]);

    useEffect(() => {
        if (currentUser) {
            console.log("DEBUG_USER_DUMP:", JSON.stringify(currentUser));
        }
    }, [currentUser]);

    const fetchTruth = async () => {
        if (!business?.id) return;

        // Fetch Snapshots
        const { data: snaps } = await supabase
            .from('occupancy_snapshots')
            .select('*')
            .eq('business_id', business.id)
            .order('updated_at', { ascending: false });

        setTruthSnapshots(snaps || []);

        // Fetch Recent Events
        const { data: evs } = await supabase
            .from('occupancy_events')
            .select('*')
            .eq('business_id', business.id)
            .order('created_at', { ascending: false })
            .limit(20);

        setTruthEvents(evs || []);
    };

    return (
        <div className="space-y-6 text-slate-300 font-mono text-xs max-w-[1600px] mx-auto p-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div>
                    <h1 className="text-xl font-bold text-white font-sans">Zero Revert Truth Debugger</h1>
                    {isLoading && <span className="text-amber-500 animate-pulse font-bold">[LOADING STORE...]</span>}
                    {lastError && <div className="text-red-500 font-bold bg-red-950/50 p-1 rounded">ERR: {lastError}</div>}
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span>
                                Auth: {currentUser ? `${currentUser.email} (${currentUser.role})` : (!isLoading ? <span className="text-red-500 font-bold">NOT AUTHENTICATED</span> : '')}
                                {currentUser && <span className="text-xs text-slate-600">[{currentUser.id}]</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", debug.realtimeStatus === 'SUBSCRIBED' ? "bg-emerald-500" : "bg-red-500 animate-pulse")} />
                            <span>Realtime: {debug.realtimeStatus}</span>
                        </div>
                        <div className="text-slate-500">Business: {business?.id}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchTruth()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/50 hover:bg-blue-900 text-blue-200 border border-blue-800 rounded-lg transition-colors"
                    >
                        <Database className="w-4 h-4" />
                        Fetch Truth
                    </button>
                    <button
                        onClick={() => refreshState()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-sans transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Force Relync
                    </button>
                </div>
            </div>

            {/* Revert Alerts */}
            {revertLogs.length > 0 && (
                <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        POTENTIAL REVERTS DETECTED
                    </div>
                    {revertLogs.map((log, i) => (
                        <div key={i} className="text-red-300 font-mono">{log}</div>
                    ))}
                    <button onClick={() => setRevertLogs([])} className="text-xs text-red-500 hover:text-red-400 underline mt-2">Clear Logs</button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
                {[
                    { id: 'UI', label: '1. UI STATE (Local)', icon: LayoutDashboard },
                    { id: 'TRACE', label: '2. WRITE TRACE (Logs)', icon: Terminal },
                    { id: 'TRUTH', label: '3. DB TRUTH (Server)', icon: Database },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold transition-all",
                            activeTab === tab.id
                                ? "bg-slate-800 text-white border-b-2 border-primary"
                                : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="space-y-6">

                {/* 1. UI STATE */}
                {activeTab === 'UI' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase bg-slate-800 p-2 rounded">Area State (Live)</h3>
                            {areas.map(area => (
                                <div key={area.id} className="bg-slate-900 p-3 rounded border border-slate-800 flex justify-between">
                                    <div>
                                        <div className="text-white font-bold text-lg">{area.current_occupancy ?? 'NULL'}</div>
                                        <div className="text-slate-400">{area.name}</div>
                                        <div className="text-[10px] text-slate-600 font-mono mt-1">
                                            Last Snap: {(area as any).last_snapshot_ts || 'None'}
                                        </div>
                                    </div>
                                    <div className="text-right text-xs">
                                        <div className="text-emerald-400">In: {area.current_traffic_in ?? areaMetrics[area.id]?.total_in ?? '-'}</div>
                                        <div className="text-amber-400">Out: {area.current_traffic_out ?? areaMetrics[area.id]?.total_out ?? '-'}</div>
                                        <div className="text-slate-500 mt-1">{area.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase bg-slate-800 p-2 rounded">Venue Metrics (Central)</h3>
                            {Object.entries(venueMetrics).map(([vid, m]) => (
                                <div key={vid} className="bg-slate-900 p-3 rounded border border-slate-800">
                                    <div className="flex justify-between">
                                        <span className="text-white font-bold">Occ: {m.current_occupancy}</span>
                                        <span className="text-xs text-slate-500">{vid}</span>
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        <span className="text-emerald-400">In: {m.total_in}</span>
                                        <span className="text-amber-400">Out: {m.total_out}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-600 mt-1">Reset: {m.last_reset_at || 'Never'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. TRACE */}
                {activeTab === 'TRACE' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-purple-400 mb-2">Write Attempts (RPC)</h3>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {debug.lastWrites?.map((w: any, i) => (
                                        <div key={i} className={cn("p-2 rounded border text-[10px]", w.type === 'RPC_ERROR' ? "bg-red-950 border-red-800" : "bg-slate-900 border-slate-800")}>
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold">{w.type}</span>
                                                <span className="text-slate-500">{new Date(w.ts).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="break-all text-slate-400">{JSON.stringify(w.params)}</div>
                                            {w.result && <div className="text-emerald-400 mt-1">Res: {JSON.stringify(w.result)}</div>}
                                            {w.error && <div className="text-red-400 mt-1">Err: {w.error}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-blue-400 mb-2">Incoming Snapshots (Realtime)</h3>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {debug.lastSnapshots?.map((s: any, i) => (
                                        <div key={i} className="bg-slate-900 p-2 rounded border border-slate-800 text-[10px]">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-white">Occ: {s.current_occupancy}</span>
                                                <span className="text-slate-500">{new Date(s.updated_at).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="text-slate-500">Area: {s.area_id}</div>
                                            <div className="text-slate-600 text-[9px]">TS: {s.updated_at}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. DB TRUTH */}
                {activeTab === 'TRUTH' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-emerald-400 mb-2">Occupancy Snapshots (Raw Table)</h3>
                            <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900 text-slate-400">
                                        <tr>
                                            <th className="p-2">Area ID</th>
                                            <th className="p-2">Occupancy</th>
                                            <th className="p-2">Updated At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {truthSnapshots.map(s => (
                                            <tr key={s.area_id} className="border-t border-slate-800">
                                                <td className="p-2 font-mono text-slate-500">{s.area_id}</td>
                                                <td className="p-2 font-bold text-white text-lg">{s.current_occupancy}</td>
                                                <td className="p-2 text-slate-400">{s.updated_at}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-blue-400 mb-2">Recent Events (Raw Table)</h3>
                            <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900 text-slate-400">
                                        <tr>
                                            <th className="p-2">Time</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Flow</th>
                                            <th className="p-2">Delta</th>
                                            <th className="p-2">Area</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {truthEvents.map(e => (
                                            <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-900">
                                                <td className="p-2 text-slate-500">{new Date(e.created_at).toLocaleTimeString()}</td>
                                                <td className="p-2 text-white">{e.event_type}</td>
                                                <td className="p-2 text-slate-300">{e.flow_type}</td>
                                                <td className={cn("p-2 font-bold", e.delta > 0 ? "text-emerald-400" : "text-amber-400")}>
                                                    {e.delta > 0 ? '+' : ''}{e.delta}
                                                </td>
                                                <td className="p-2 text-slate-500 font-mono text-[10px]">{e.area_id}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
