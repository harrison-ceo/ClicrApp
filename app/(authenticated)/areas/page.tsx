"use client";
import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { Layers, Search, Filter, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AreasPage() {
    const { areas, clicrs, venues } = useApp();
    const [search, setSearch] = useState('');
    const [filterVenue, setFilterVenue] = useState('ALL');

    // Filtering
    const filteredAreas = areas.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
        const matchesVenue = filterVenue === 'ALL' || a.venue_id === filterVenue;
        return matchesSearch && matchesVenue;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Areas</h1>
                    <p className="text-slate-400">Manage monitoring zones and assigned clickers</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search areas..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-primary outline-none"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={filterVenue}
                            onChange={(e) => setFilterVenue(e.target.value)}
                            className="appearance-none bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-2 text-white focus:border-primary outline-none"
                        >
                            <option value="ALL">All Venues</option>
                            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAreas.map(area => {
                    const areaClicrs = clicrs.filter(c => c.area_id === area.id);
                    const venue = venues.find(v => v.id === area.venue_id);

                    // Calculate Live Occupancy (Source of Truth: Occupancy Snapshot)
                    const liveOcc = area.current_occupancy || 0;

                    // Capacity & Percentage
                    const capacity = area.default_capacity || area.capacity_limit || 0;
                    const percentage = capacity > 0 ? Math.round((liveOcc / capacity) * 100) : null;

                    // Status Logic
                    let statusColor = "bg-emerald-500";
                    let statusText = "Normal";

                    if (percentage !== null) {
                        if (percentage > 95) { statusColor = "bg-red-500"; statusText = "Critical"; }
                        else if (percentage > 80) { statusColor = "bg-amber-500"; statusText = "Near Cap"; }
                    } else {
                        statusColor = "bg-slate-700";
                        statusText = "No Cap";
                    }

                    return (
                        <Link key={area.id} href={`/areas/${area.id}`} className="group relative block">
                            <div className="glass-card p-6 rounded-xl relative overflow-hidden transition-all duration-300 group-hover:bg-slate-800/80 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                                {/* Capacity Bar */}
                                <div className="absolute top-0 left-0 h-1 w-full bg-slate-800">
                                    <div className={cn("h-full transition-all duration-500", statusColor)} style={{ width: `${Math.min(percentage || 0, 100)}%` }} />
                                </div>

                                <div className="flex items-start justify-between mb-4 mt-2">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            {venue?.name}
                                        </span>
                                        <h2 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{area.name}</h2>
                                    </div>
                                    <div className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", statusColor.replace('bg-', 'bg-opacity-10 text-'))}>
                                        {statusText}
                                    </div>
                                </div>

                                <div className="flex items-end justify-between mb-6">
                                    <div>
                                        <div className="text-4xl font-bold text-white tabular-nums">{liveOcc}</div>
                                        <div className="text-xs text-slate-400">Live Occupancy</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-slate-300">/ {capacity > 0 ? capacity : '—'} Cap</div>
                                        <div className={cn("text-xs font-bold", statusColor.replace('bg-', 'text-'))}>{percentage !== null ? `${percentage}% Full` : '—'}</div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-between text-slate-400 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4" />
                                        <span>{areaClicrs.length} Active Clicrs</span>
                                    </div>
                                    {area.is_active || area.active ? // handle both fields
                                        <div className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3 h-3" /> Active</div> :
                                        <div className="flex items-center gap-1 text-slate-500 text-xs"><AlertCircle className="w-3 h-3" /> Inactive</div>
                                    }
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
}
