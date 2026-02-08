"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Area, AreaType, CountingMode } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Plus, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRole } from '@/components/RoleContext';

type AreaRow = Area & { capacity?: number; capacity_max?: number; percent_full?: number; area_type?: string };

type VenueAreaDisplay = {
    id: string;
    name: string;
    venue_id?: string;
    current_occupancy?: number;
    capacity: number;
    percent_full: number;
    area_type?: string;
    capacity_max?: number;
    default_capacity?: number;
    [key: string]: unknown;
};

export default function VenueAreas({ venueId, venueCapacity = 0, venueName }: { venueId: string; venueCapacity?: number; venueName?: string }) {
    const role = useRole();
    const isStaff = role === 'staff';
    const [areas, setAreas] = useState<AreaRow[]>([]);
    const [deviceCountByAreaId, setDeviceCountByAreaId] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchAreas = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        const supabase = createClient();
        const { data, error } = await supabase.from('areas').select('*').eq('venue_id', venueId);
        setLoading(false);
        if (error) {
            setFetchError(error.message);
            setAreas([]);
            return;
        }
        setAreas((data ?? []) as AreaRow[]);
    }, [venueId]);

    useEffect(() => {
        const id = typeof venueId === 'string' ? venueId : '';
        if (!id) {
            queueMicrotask(() => {
                setLoading(false);
                setFetchError('Invalid venue');
                setAreas([]);
            });
            return;
        }
        let cancelled = false;
        const supabase = createClient();
        supabase
            .from('areas')
            .select('*')
            .eq('venue_id', id)
            .then(({ data, error }) => {
                if (cancelled) return;
                setLoading(false);
                if (error) {
                    setFetchError(error.message);
                    setAreas([]);
                    return;
                }
                setFetchError(null);
                setAreas((data ?? []) as AreaRow[]);
            });
        return () => {
            cancelled = true;
        };
    }, [venueId]);

    useEffect(() => {
        if (areas.length === 0) {
            queueMicrotask(() => setDeviceCountByAreaId({}));
            return;
        }
        let cancelled = false;
        const supabase = createClient();
        const areaIds = areas.map((a) => a.id);
        supabase
            .from('devices')
            .select('area_id')
            .in('area_id', areaIds)
            .then(({ data }) => {
                if (cancelled) return;
                const count: Record<string, number> = {};
                areaIds.forEach((id) => (count[id] = 0));
                (data ?? []).forEach((row: { area_id: string }) => {
                    count[row.area_id] = (count[row.area_id] ?? 0) + 1;
                });
                setDeviceCountByAreaId(count);
            });
        return () => { cancelled = true; };
    }, [areas]);

    const venueAreas: VenueAreaDisplay[] = useMemo(() => {
        return areas.map(area => {
            const occ = Number(area.current_occupancy) || 0;
            const rawCap = (area as { capacity?: number }).capacity ?? area.capacity_max ?? area.default_capacity ?? venueCapacity;
            const cap = Number(rawCap) || 0;
            const percent_full = cap > 0 ? Math.round((occ / cap) * 100) : 0;
            return {
                ...area,
                name: area.name ?? '',
                capacity: cap,
                percent_full,
                area_type: (area as { area_type?: string }).area_type,
            } as VenueAreaDisplay;
        });
    }, [areas, venueCapacity]);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<Partial<Area> | null>(null);
    const [saving, setSaving] = useState(false);

    const handleCreate = () => {
        setEditingArea({
            venue_id: venueId,
            name: '',
            area_type: 'MAIN',
            capacity_max: 0,
            default_capacity: 0,
            counting_mode: 'BOTH',
            is_active: true,
        });
        setIsEditModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingArea?.name?.trim()) return;

        const supabase = createClient();
        const capacity = editingArea.default_capacity ?? (editingArea as { capacity_max?: number }).capacity_max ?? 0;
        const payload = {
            venue_id: venueId,
            name: editingArea.name.trim(),
            capacity,
            area_type: (editingArea.area_type as string) ?? 'MAIN',
            counting_mode: (editingArea.counting_mode as string) ?? 'BOTH',
            is_active: editingArea.is_active !== false,
            updated_at: new Date().toISOString(),
        };

        setSaving(true);
        if (editingArea.id) {
            await supabase.from('areas').update(payload).eq('id', editingArea.id);
        } else {
            await supabase.from('areas').insert(payload);
        }
        setSaving(false);
        setIsEditModalOpen(false);
        setEditingArea(null);
        await fetchAreas();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Venue Areas</h2>
                {!isStaff && (
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Area
                    </button>
                )}
            </div>

            {fetchError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {fetchError}
                </div>
            )}
            {loading ? (
                <div className="p-8 text-center text-slate-500">Loading areas…</div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venueAreas.length === 0 && !fetchError && (
                    <div className="col-span-full p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                        <p className="text-slate-500">No areas configured yet. Add one to start tracking occupancy.</p>
                    </div>
                )}

                {venueAreas.map(area => {
                    const liveOcc = Number(area.current_occupancy) || 0;
                    const capacity = area.capacity ?? 0;
                    const percentage = area.percent_full ?? (capacity > 0 ? Math.round((liveOcc / capacity) * 100) : null);

                    let statusColor = "bg-emerald-500";
                    let statusText = "Normal";
                    let badgeClass = "bg-emerald-500/20 text-emerald-400";
                    let percentClass = "text-emerald-400";
                    if (percentage !== null && percentage !== undefined) {
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

                                <div className="flex items-start justify-between mb-4 mt-2">
                                    <div>
                                        {venueName && (
                                            <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                {venueName}
                                            </span>
                                        )}
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
                                        <div className={cn("text-xs font-bold", percentClass)}>{percentage != null ? `${percentage}% Full` : '—'}</div>
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

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsEditModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold mb-4">{editingArea?.id ? 'Edit Area' : 'Create Area'}</h2>
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="venue-area-name" className="text-sm font-medium text-slate-400">Area Name</label>
                                    <input
                                        id="venue-area-name"
                                        type="text"
                                        value={editingArea?.name ?? ''}
                                        onChange={e => setEditingArea(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="e.g. Main Floor"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Type</label>
                                        <select
                                            value={typeof editingArea?.area_type === 'string' ? editingArea.area_type : 'MAIN'}
                                            onChange={e => setEditingArea(prev => ({ ...prev, area_type: e.target.value as AreaType }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value="MAIN">Main</option>
                                            <option value="ENTRY">Entry</option>
                                            <option value="VIP">VIP</option>
                                            <option value="PATIO">Patio</option>
                                            <option value="BAR">Bar</option>
                                            <option value="EVENT_SPACE">Event Space</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Capacity</label>
                                        <input
                                            type="number"
                                            value={editingArea?.default_capacity !== undefined && editingArea?.default_capacity !== null ? Number(editingArea.default_capacity) : ''}
                                            onChange={e => setEditingArea(prev => ({ ...prev, default_capacity: Number(e.target.value) || 0 }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            placeholder="0 for unlimited"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Counting Mode</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['MANUAL', 'AUTO_FROM_SCANS', 'BOTH'] as CountingMode[]).map(mode => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setEditingArea(prev => ({ ...prev, counting_mode: mode }))}
                                                className={cn(
                                                    "px-2 py-2 rounded-lg text-xs font-medium border transition-colors",
                                                    editingArea?.counting_mode === mode
                                                        ? "bg-primary/20 text-primary border-primary/50"
                                                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
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
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Saving…' : 'Save Area'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
