'use client';

import React from 'react';
import { useApp } from '@/lib/store';

export default function RuntimeInspector() {
    const { debug, business, venues, areas, clicrs, events, scanEvents, lastError } = useApp();

    return (
        <div className="space-y-8">
            {/* Realtime Status */}
            <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">3. Runtime Health (Client Source)</h2>
                <div className="grid grid-cols-[120px_1fr] gap-2 font-mono text-sm">
                    <div className="text-slate-500">Realtime:</div>
                    <div>
                        <span className={`inline-block px-2 py-1 rounded text-white text-xs font-bold ${debug.realtimeStatus === 'SUBSCRIBED' ? 'bg-green-500' :
                            debug.realtimeStatus === 'CONNECTING' ? 'bg-amber-500' : 'bg-red-500'
                            }`}>
                            {debug.realtimeStatus}
                        </span>
                    </div>
                    <div className="text-slate-500">Last Error:</div>
                    <div className="text-red-500 font-bold">{lastError || 'None'}</div>
                    <div className="text-slate-500">Active Biz:</div>
                    <div>{business?.id || 'None'} ({business?.name})</div>
                </div>
            </section>

            {/* Realtime Events Log */}
            <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">4. Recent Realtime Payloads (Last 5)</h2>
                <div className="font-mono text-xs overflow-auto max-h-60 bg-slate-50 p-2 rounded">
                    {debug.lastEvents.length === 0 ? <div className="text-slate-400 italic">No events received since load.</div> : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="pb-2">Time</th>
                                    <th className="pb-2">Type</th>
                                    <th className="pb-2">Table</th>
                                    <th className="pb-2">Payload Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {debug.lastEvents.map((e: any, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-100">
                                        <td className="py-2 pr-2">{new Date(e.commit_timestamp).toLocaleTimeString() || '-'}</td>
                                        <td className="py-2 pr-2 font-bold text-blue-600">{e.eventType}</td>
                                        <td className="py-2 pr-2">{e.table}</td>
                                        <td className="py-2">
                                            {e.new ? (
                                                <span title={JSON.stringify(e.new, null, 2)}>
                                                    ID: {e.new.id?.substring(0, 8)}... |
                                                    {e.table === 'occupancy_snapshots' ? ` Occ: ${e.new.current_occupancy}` : ''}
                                                    {e.table === 'occupancy_events' ? ` Delta: ${e.new.delta}` : ''}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            {/* Local State Inspectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Local Occupancy (Store)</h2>
                    <div className="font-mono text-xs">
                        {areas.map(a => (
                            <div key={a.id} className="flex flex-col py-1 border-b last:border-0">
                                <div className="flex justify-between">
                                    <span>{a.name} ({a.id.substring(0, 6)}...):</span>
                                    <span className="font-bold">{a.current_occupancy}</span>
                                </div>
                                <div className="flex justify-end gap-2 text-xs text-slate-400">
                                    <span className="text-emerald-600">IN: {a.current_traffic_in ?? '-'}</span>
                                    <span className="text-amber-600">OUT: {a.current_traffic_out ?? '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Recent Scans (Store)</h2>
                    <div className="font-mono text-xs max-h-40 overflow-auto">
                        {scanEvents.slice(0, 10).map(s => (
                            <div key={s.id} className="py-1 border-b last:border-0">
                                {new Date(s.timestamp).toLocaleTimeString()} - {s.scan_result} ({s.age}y - {s.sex})
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
