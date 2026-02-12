
"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TotalsLatencyDebug() {
    const { currentUser, traffic, recordEvent, events } = useApp();
    const [logs, setLogs] = useState<{ ts: number, msg: string, latency?: number }[]>([]);
    const [lastClick, setLastClick] = useState<number>(0);

    // Watch traffic.total_in changes to measure latency
    useEffect(() => {
        if (lastClick > 0) {
            const now = Date.now();
            const latency = now - lastClick;
            setLogs(prev => [{ ts: now, msg: `UI Update: In=${traffic.total_in}`, latency }, ...prev]);
            setLastClick(0); // Reset
        }
    }, [traffic.total_in]);

    const handleTestClick = async () => {
        const start = Date.now();
        setLastClick(start);
        setLogs(prev => [{ ts: start, msg: "Click Triggered" }, ...prev]);

        // Mock Event
        // Need a valid venue/area/clicr ID usually, but let's try to grab first available from context
        // This is a debug page, might be standalone.
        // Ideally we need context.
        // Let's just log "Context Missing" if empty.

        // We can't really call recordEvent without IDs. 
        // We'll instruct user to use real buttons.
        setLogs(prev => [{ ts: start, msg: "Please use real buttons to test. This panel just monitors state changes." }, ...prev]);
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono text-xs">
            <Link href="/dashboard" className="flex items-center gap-2 mb-4 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <h1 className="text-2xl font-bold text-blue-500 mb-4">TOTALS LATENCY DEBUG</h1>

            <div className="grid grid-cols-2 gap-8">
                <div className="bg-slate-900 p-4 rounded border border-slate-700">
                    <h2 className="text-lg font-bold mb-4">Live Totals</h2>
                    <div className="text-4xl text-emerald-400 mb-2">{traffic.total_in} <span className="text-sm text-slate-500">IN</span></div>
                    <div className="text-4xl text-rose-400 mb-2">{traffic.total_out} <span className="text-sm text-slate-500">OUT</span></div>
                    <div className="text-xl text-blue-400">Net: {traffic.net_delta}</div>
                    <div className="text-sm text-slate-500 mt-2">Events: {traffic.event_count}</div>
                    <div className="text-sm text-slate-500">Last Event ID: {events[0]?.id}</div>
                </div>

                <div className="bg-slate-900 p-4 rounded border border-slate-700 h-[400px] overflow-auto">
                    <h2 className="text-lg font-bold mb-4">Latency Log</h2>
                    <p className="text-slate-500 mb-2">Open this page in a separate window or keep visible while tapping on another device/window.</p>
                    {logs.map((L, i) => (
                        <div key={i} className="mb-1 border-b border-slate-800 pb-1">
                            <span className="text-slate-500 mr-2">[{new Date(L.ts).toISOString().split('T')[1].slice(0, -1)}]</span>
                            <span className={L.latency ? "text-green-400 font-bold" : "text-slate-300"}>
                                {L.msg}
                            </span>
                            {L.latency !== undefined && (
                                <span className="ml-2 text-yellow-400">{L.latency}ms</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
