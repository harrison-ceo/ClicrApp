"use client";

import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import Link from 'next/link';

export default function QAPage() {
    const { business, venues, areas, clicrs, refreshTrafficStats } = useApp();
    const [actionResult, setActionResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const runAction = async (name: string, fn: () => Promise<any>) => {
        setLoading(true);
        try {
            const res = await fn();
            setActionResult({
                action: name,
                success: true,
                data: res,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            setActionResult({
                action: name,
                success: false,
                error: (e as Error).message,
                timestamp: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    };

    const testTrafficFetch = async () => {
        const res = await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_TRAFFIC_STATS' })
        });
        return await res.json();
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-mono">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h1 className="text-3xl font-bold text-white">QA & Reliability Hub</h1>
                    <div className="space-x-4">
                        <Link href="/dashboard" className="text-blue-400 hover:underline">Dashboard</Link>
                        <Link href="/debug" className="text-blue-400 hover:underline">Diagnostics</Link>
                    </div>
                </div>

                {/* ACTION RESULT */}
                <div className="bg-slate-800 p-4 rounded border border-slate-700 min-h-[100px]">
                    <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Last Action Result</h2>
                    {loading ? <div className="text-yellow-400 animate-pulse">Running...</div> : (
                        actionResult ? (
                            <pre className={`text-xs overflow-auto ${actionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                {JSON.stringify(actionResult, null, 2)}
                            </pre>
                        ) : <div className="text-slate-600 italic">No actions run yet.</div>
                    )}
                </div>

                {/* TEST SUITES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* 1. TRAFFIC STATS (The problematic one) */}
                    <section className="bg-slate-800/50 p-6 rounded border border-slate-700">
                        <h2 className="text-xl font-bold text-white mb-4">1. Traffic Stats Verification</h2>
                        <div className="space-y-4">
                            <button
                                onClick={() => runAction('Fetch Traffic Stats API', testTrafficFetch)}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold"
                            >
                                Test API: GET_TRAFFIC_STATS
                            </button>
                            <button
                                onClick={() => runAction('Store: refreshTrafficStats', async () => { await refreshTrafficStats(); return "Refreshed Store"; })}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-bold"
                            >
                                Trigger Store Refresh
                            </button>
                            <button
                                onClick={() => runAction('Simulate +1 Click (API)', async () => {
                                    const area = areas[0];
                                    if (!area) throw new Error("No areas found to test");
                                    const payload = {
                                        venue_id: area.venue_id,
                                        area_id: area.id,
                                        clicr_id: 'qa_device_001',
                                        delta: 1,
                                        flow_type: 'IN',
                                        event_type: 'qa_test',
                                        business_id: business?.id,
                                        timestamp: Date.now()
                                    };
                                    const res = await fetch('/api/sync', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ action: 'RECORD_EVENT', payload })
                                    });
                                    if (!res.ok) {
                                        const err = await res.json();
                                        throw new Error(err.error || res.statusText);
                                    }
                                    return await res.json();
                                })}
                                className="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold mt-2"
                            >
                                Simulate +1 Click
                            </button>
                            <div className="border-t border-slate-700 pt-4">
                                <h3 className="text-sm font-bold text-slate-400 mb-2">Current Shop State:</h3>
                                <ul className="text-xs space-y-2">
                                    {areas.map(a => (
                                        <li key={a.id} className="flex justify-between">
                                            <span>{a.name}</span>
                                            <span className="space-x-2">
                                                <span className="text-green-400">IN: {a.current_traffic_in}</span>
                                                <span className="text-red-400">OUT: {a.current_traffic_out}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 2. DATA SEEDING */}
                    <section className="bg-slate-800/50 p-6 rounded border border-slate-700">
                        <h2 className="text-xl font-bold text-white mb-4">2. Data Seeding</h2>
                        <div className="space-y-2">
                            <p className="text-xs text-slate-400 mb-4">
                                Creates dummy data for testing scalability and lists.
                            </p>
                            <button className="w-full py-2 bg-slate-700 text-slate-500 cursor-not-allowed" disabled>
                                Seed 50 Guests (Coming Soon)
                            </button>
                            <button className="w-full py-2 bg-slate-700 text-slate-500 cursor-not-allowed" disabled>
                                Seed 1000 Events (Coming Soon)
                            </button>
                        </div>
                    </section>

                    {/* 3. REALTIME SIMULATION */}
                    <section className="bg-slate-800/50 p-6 rounded border border-slate-700">
                        <h2 className="text-xl font-bold text-white mb-4">3. Realtime Sim</h2>
                        <div className="space-y-2">
                            <button className="w-full py-2 bg-emerald-600/20 text-emerald-500 border border-emerald-500/50 hover:bg-emerald-600/30">
                                Open 2nd Tab (Browser)
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
