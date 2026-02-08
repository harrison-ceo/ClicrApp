"use client";

import React, { useState, useEffect } from 'react';
import { Layers, Search, Filter, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Area } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useRole } from '@/components/RoleContext';

type VenueRow = { id: string; name: string };

const AREA_TYPES = ['MAIN', 'ENTRY', 'VIP', 'PATIO', 'BAR', 'EVENT_SPACE', 'OTHER'] as const;
const COUNTING_MODES = ['MANUAL', 'AUTO_FROM_SCANS', 'BOTH'] as const;

type NewAreaForm = {
    venue_id: string;
    name: string;
    capacity: number;
    area_type: string;
    counting_mode: string;
};

const defaultNewArea: NewAreaForm = {
    venue_id: '',
    name: '',
    capacity: 0,
    area_type: 'MAIN',
    counting_mode: 'BOTH',
};

export default function AreasPage() {
    const role = useRole();
    const isStaff = role === 'staff';
    const [search, setSearch] = useState('');
    const [filterVenue, setFilterVenue] = useState('ALL');
    const [areas, setAreas] = useState<Area[]>([]);
    const [venues, setVenues] = useState<VenueRow[]>([]);
    const [deviceCountByAreaId, setDeviceCountByAreaId] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newArea, setNewArea] = useState<NewAreaForm>(defaultNewArea);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const supabase = createClient();
            const [areasRes, venuesRes] = await Promise.all([
                supabase.from('areas').select('*'),
                supabase.from('venues').select('id, name'),
            ]);
            if (cancelled) return;
            const areaList = (areasRes.data ?? []) as Area[];
            const venueList = (venuesRes.data ?? []) as VenueRow[];
            setAreas(areaList);
            setVenues(venueList);
            if (areaList.length > 0) {
                const { data: devicesData } = await supabase.from('devices').select('area_id').in('area_id', areaList.map((a) => a.id));
                if (cancelled) return;
                const count: Record<string, number> = {};
                areaList.forEach((a) => (count[a.id] = 0));
                (devicesData ?? []).forEach((row: { area_id: string }) => { count[row.area_id] = (count[row.area_id] ?? 0) + 1; });
                setDeviceCountByAreaId(count);
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const filteredAreas = areas.filter((a: Area) => {
        const matchesSearch = a.name?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const matchesVenue = filterVenue === 'ALL' || a.venue_id === filterVenue;
        return matchesSearch && matchesVenue;
    });

    const handleAddArea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newArea.venue_id || !newArea.name.trim()) return;
        setSaving(true);
        const supabase = createClient();
        const { error } = await supabase.from('areas').insert({
            venue_id: newArea.venue_id,
            name: newArea.name.trim(),
            capacity: newArea.capacity || 0,
            area_type: newArea.area_type || 'MAIN',
            counting_mode: newArea.counting_mode || 'BOTH',
            is_active: true,
        });
        setSaving(false);
        if (error) return;
        setAddModalOpen(false);
        setNewArea(defaultNewArea);
        const { data } = await supabase.from('areas').select('*');
        setAreas((data ?? []) as Area[]);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Areas</h1>
                    <p className="text-slate-400">Manage monitoring zones and assigned clickers</p>
                </div>

                <div className="flex items-center gap-3">
                    {!isStaff && (
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            Add Area
                        </button>
                    )}
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

            {loading ? (
                <div className="py-12 text-center text-slate-500">Loading areas…</div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAreas.map(area => {
                    const venue = venues.find(v => v.id === area.venue_id);
                    const liveOcc = Number(area.current_occupancy) || 0;
                    const rawCap = (area as { capacity?: number }).capacity ?? area.default_capacity ?? (area as { capacity_limit?: number }).capacity_limit;
                    const capacity = Number(rawCap) || 0;
                    const percentage = capacity > 0 ? Math.round((liveOcc / capacity) * 100) : null;

                    let statusColor = "bg-emerald-500";
                    let statusText = "Normal";
                    let badgeClass = "bg-emerald-500/20 text-emerald-400";
                    let percentClass = "text-emerald-400";
                    if (percentage !== null) {
                        if (percentage > 95) {
                            statusColor = "bg-red-500";
                            statusText = "Critical";
                            badgeClass = "bg-red-500/20 text-red-400";
                            percentClass = "text-red-400";
                        } else if (percentage > 80) {
                            statusColor = "bg-amber-500";
                            statusText = "Near Cap";
                            badgeClass = "bg-amber-500/20 text-amber-400";
                            percentClass = "text-amber-400";
                        }
                    } else {
                        statusColor = "bg-slate-700";
                        statusText = "No Cap";
                        badgeClass = "bg-slate-700/50 text-slate-400";
                        percentClass = "text-slate-500";
                    }

                    const isActive = area.is_active !== false && (area as { active?: boolean }).active !== false;

                    return (
                        <Link key={area.id} href={`/areas/${area.id}`} className="group relative block">
                            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl relative overflow-hidden transition-all duration-300 group-hover:bg-slate-800/80 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                                <div className="absolute top-0 left-0 h-1 w-full bg-slate-800">
                                    <div className={cn("h-full transition-all duration-500", statusColor)} style={{ width: `${Math.min(percentage ?? 0, 100)}%` }} />
                                </div>

                                <div className="flex items-start justify-between mb-4 mt-2">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            {venue?.name}
                                        </span>
                                        <h2 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{area.name}</h2>
                                    </div>
                                    <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", badgeClass)}>
                                        {statusText}
                                    </span>
                                </div>

                                <div className="flex items-end justify-between mb-6">
                                    <div>
                                        <div className="text-4xl font-bold text-white tabular-nums">{liveOcc}</div>
                                        <div className="text-xs text-slate-400">Live Occupancy</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-slate-300">/ {capacity > 0 ? capacity : '—'} Cap</div>
                                        <div className={cn("text-xs font-bold", percentClass)}>{percentage !== null ? `${percentage}% Full` : '—'}</div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-between text-slate-400 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4" />
                                        <span>{deviceCountByAreaId[area.id] ?? 0} device{(deviceCountByAreaId[area.id] ?? 0) !== 1 ? 's' : ''}</span>
                                    </div>
                                    {isActive ? (
                                        <div className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3 h-3" /> Active</div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-slate-500 text-xs"><AlertCircle className="w-3 h-3" /> Inactive</div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            )}

            {/* Add Area modal */}
            {!isStaff && addModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => !saving && setAddModalOpen(false)}
                >
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold text-white mb-4">Add Area</h2>
                        <form onSubmit={handleAddArea} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="area-venue" className="text-sm font-medium text-slate-400">Venue</label>
                                <select
                                    id="area-venue"
                                    required
                                    value={newArea.venue_id}
                                    onChange={e => setNewArea(prev => ({ ...prev, venue_id: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="">Select a venue</option>
                                    {venues.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="area-name" className="text-sm font-medium text-slate-400">Area Name</label>
                                <input
                                    id="area-name"
                                    type="text"
                                    required
                                    value={newArea.name}
                                    onChange={e => setNewArea(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="e.g. Main Floor"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="area-type" className="text-sm font-medium text-slate-400">Type</label>
                                    <select
                                        id="area-type"
                                        value={newArea.area_type}
                                        onChange={e => setNewArea(prev => ({ ...prev, area_type: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {AREA_TYPES.map(t => (
                                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="area-capacity" className="text-sm font-medium text-slate-400">Capacity</label>
                                    <input
                                        id="area-capacity"
                                        type="number"
                                        min={0}
                                        value={newArea.capacity || ''}
                                        onChange={e => setNewArea(prev => ({ ...prev, capacity: Number(e.target.value) || 0 }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="0 for unlimited"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-sm font-medium text-slate-400">Counting Mode</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {COUNTING_MODES.map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setNewArea(prev => ({ ...prev, counting_mode: mode }))}
                                            className={cn(
                                                'px-2 py-2 rounded-lg text-xs font-medium border transition-colors',
                                                newArea.counting_mode === mode
                                                    ? 'bg-primary/20 text-primary border-primary/50'
                                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                                            )}
                                        >
                                            {mode.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => !saving && setAddModalOpen(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    {saving ? 'Saving…' : 'Add Area'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
