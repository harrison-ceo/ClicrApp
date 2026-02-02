"use client";

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { ArrowRight, Play, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClicrListPage() {
    const { clicrs, areas, venues, isLoading } = useApp();

    if (isLoading) {
        return <div className="p-8 text-white">Loading Clicrs...</div>;
    }

    // Grouping Logic
    const venuesWithContent = (venues || []).map(venue => {
        const venueAreas = (areas || []).filter(a => a.venue_id === venue.id);

        const areasWithClicrs = venueAreas.map(area => {
            const areaClicrs = (clicrs || []).filter(c => c.area_id === area.id);
            return { ...area, clicrs: areaClicrs };
        });

        return { ...venue, areas: areasWithClicrs };
    });

    return (
        <div className="space-y-12 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Clicrs</h1>
                    <p className="text-slate-400">Select a device to start counting.</p>
                </div>
            </div>

            {venuesWithContent.map(venue => (
                <div key={venue.id} className="space-y-6">
                    {/* Venue Header */}
                    <div className="flex items-center gap-4 border-b border-white/10 pb-2">
                        <h2 className="text-2xl font-bold text-primary">{venue.name}</h2>
                    </div>

                    {venue.areas.map(area => (
                        <div key={area.id} className="ml-0 md:ml-4">
                            {/* Area Header */}
                            <div className="flex items-center gap-2 mb-4 text-slate-300">
                                <Layers className="w-4 h-4 text-slate-500" />
                                <h3 className="text-lg font-semibold">{area.name}</h3>
                                <span className="text-xs text-slate-600 uppercase tracking-widest ml-2">Area</span>
                            </div>

                            {/* Clicrs Grid */}
                            {(area.clicrs || []).length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {area.clicrs.map(clicr => (
                                        <ClicrCard key={clicr.id} clicr={clicr} />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-slate-600 text-sm ml-6">
                                    No Clicrs assigned to this area.
                                </div>
                            )}
                        </div>
                    ))}

                    {venue.areas.length === 0 && (
                        <div className="p-6 text-slate-500 italic">No areas defined for this venue.</div>
                    )}
                </div>
            ))}
        </div>
    );
}

function ClicrCard({ clicr }: { clicr: any }) {
    const flowMode = clicr.flow_mode || (clicr.role === 'ENTRY/EXIT' ? 'BIDIRECTIONAL' : 'BIDIRECTIONAL');

    return (
        <Link
            href={`/clicr/${clicr.id}`}
            className="glass-card p-5 rounded-xl hover:bg-slate-800/80 transition-all group relative overflow-hidden border border-white/5 hover:border-primary/50"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Play className="w-20 h-20 text-primary" />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                        {clicr.name}
                    </h3>

                    <div className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        flowMode === 'IN_ONLY' ? "bg-emerald-500/10 text-emerald-400" :
                            flowMode === 'OUT_ONLY' ? "bg-amber-500/10 text-amber-400" :
                                "bg-blue-500/10 text-blue-400"
                    )}>
                        {flowMode.replace('_', ' ')}
                    </div>
                </div>

                <div className="flex items-end justify-between mt-4">
                    <div className="text-3xl font-mono font-bold text-slate-200">
                        {clicr.current_count}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 group-hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                        Open <ArrowRight className="w-3 h-3" />
                    </div>
                </div>
            </div>
        </Link>
    )
}
