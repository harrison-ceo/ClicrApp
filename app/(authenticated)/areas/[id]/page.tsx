"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Users, Plus, Pencil, Trash2,
    ArrowRightLeft, LogIn, LogOut, Save, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRole } from '@/components/RoleContext';

type AreaRow = {
    id: string;
    name: string;
    venue_id: string;
    capacity?: number | null;
    current_occupancy?: number | null;
    is_active?: boolean;
    [key: string]: unknown;
};
type VenueRow = { id: string; name: string };
type DeviceRow = {
    id: string;
    area_id: string;
    name: string;
    flow_mode: string;
    current_count: number;
    is_active: boolean;
};

export default function AreaDetailPage() {
    const params = useParams();
    const id = typeof params?.id === 'string' ? params.id : '';
    const role = useRole();
    const isStaff = role === 'staff';

    const [area, setArea] = useState<AreaRow | null>(null);
    const [venue, setVenue] = useState<VenueRow | null>(null);
    const [devices, setDevices] = useState<DeviceRow[]>([]);
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditingArea, setIsEditingArea] = useState(false);
    const [showAddClicr, setShowAddClicr] = useState(false);
    const [clicrToDelete, setClicrToDelete] = useState<DeviceRow | null>(null);
    const [editName, setEditName] = useState('');
    const [editCap, setEditCap] = useState(0);
    const [newClicrName, setNewClicrName] = useState('');
    const [newClicrCommand, setNewClicrCommand] = useState('');
    const [newClicrFlow, setNewClicrFlow] = useState<'IN_ONLY' | 'OUT_ONLY' | 'BIDIRECTIONAL'>('BIDIRECTIONAL');
    const [savingClicr, setSavingClicr] = useState(false);
    const [savingArea, setSavingArea] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) return;
        const supabase = createClient();
        const { data: areaData, error: areaErr } = await supabase
            .from('areas')
            .select('*')
            .eq('id', id)
            .single();
        if (areaErr || !areaData) {
            setError(areaErr?.message ?? 'Area not found');
            setArea(null);
            setVenue(null);
            setDevices([]);
            setTotalIn(0);
            setTotalOut(0);
            setLoading(false);
            return;
        }
        const areaRow = areaData as AreaRow;
        setArea(areaRow);
        setEditName(areaRow.name ?? '');
        setEditCap(Number(areaRow.capacity) || 0);

        const { data: venueData } = await supabase
            .from('venues')
            .select('id, name')
            .eq('id', areaRow.venue_id)
            .single();
        setVenue((venueData ?? null) as VenueRow | null);

        const { data: devicesData } = await supabase
            .from('devices')
            .select('id, area_id, name, flow_mode, current_count, is_active')
            .eq('area_id', id);
        setDevices((devicesData ?? []) as DeviceRow[]);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data: logsData } = await supabase
            .from('occupancy_logs')
            .select('delta')
            .eq('area_id', id)
            .gte('created_at', startOfDay.toISOString());
        let inSum = 0;
        let outSum = 0;
        (logsData ?? []).forEach((row: { delta: number }) => {
            if (row.delta > 0) inSum += row.delta;
            else outSum += Math.abs(row.delta);
        });
        setTotalIn(inSum);
        setTotalOut(outSum);
        setError(null);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        if (!id) {
            queueMicrotask(() => {
                setLoading(false);
                setError('Invalid area id');
            });
            return;
        }
        queueMicrotask(() => {
            setLoading(true);
            setError(null);
        });
        const t = setTimeout(() => { fetchData(); }, 0);
        return () => clearTimeout(t);
    }, [id, fetchData]);

    useEffect(() => {
        if (!id) return;
        const supabase = createClient();
        const channel = supabase.channel(`area-${id}`);
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'areas', filter: `id=eq.${id}` },
            () => fetchData()
        );
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'devices', filter: `area_id=eq.${id}` },
            () => fetchData()
        );
        channel.subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, fetchData]);

    const capacity = Number(area?.capacity) || 0;
    const liveOccupancy = area?.current_occupancy != null ? Number(area.current_occupancy) : devices.reduce((acc, d) => acc + (d.current_count ?? 0), 0);
    const percentage = capacity > 0 ? Math.round((liveOccupancy / capacity) * 100) : 0;
    const activeDevices = devices.filter(d => d.is_active !== false);

    const handleSaveArea = async () => {
        if (!area) return;
        if (!editName.trim()) return;
        setSavingArea(true);
        const supabase = createClient();
        await supabase
            .from('areas')
            .update({
                name: editName.trim(),
                capacity: Math.max(0, editCap),
                updated_at: new Date().toISOString(),
            })
            .eq('id', area.id);
        setSavingArea(false);
        setIsEditingArea(false);
        await fetchData();
    };

    const handleAddClicr = async () => {
        if (!area) return;
        if (newClicrName.trim()) {
            setSavingClicr(true);
            const supabase = createClient();
            const { error: insertErr } = await supabase.from('devices').insert({
                area_id: area.id,
                name: newClicrName.trim(),
                flow_mode: newClicrFlow,
                current_count: 0,
                is_active: true,
            });
            setSavingClicr(false);
            if (insertErr) {
                alert(`Failed to add Clicr: ${insertErr.message}`);
                return;
            }
            setShowAddClicr(false);
            setNewClicrName('');
            setNewClicrCommand('');
            setNewClicrFlow('BIDIRECTIONAL');
            await fetchData();
        }
    };

    const confirmDeleteClicr = async () => {
        if (!clicrToDelete) return;
        const supabase = createClient();
        await supabase
            .from('devices')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', clicrToDelete.id);
        setClicrToDelete(null);
        await fetchData();
    };

    if (loading) return <div className="p-8 text-white">Loading area…</div>;
    if (error || !area) return <div className="p-8 text-white">{error ?? 'Area not found'}</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                <Link href="/areas" className="hover:text-white transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Areas
                </Link>
                <span>/</span>
                <span className="text-slate-300">{venue?.name ?? 'Venue'}</span>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                <div>
                    {isEditingArea ? (
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
                            <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-transparent text-2xl font-bold text-white outline-none w-[200px]"
                                autoFocus
                            />
                            <input
                                type="number"
                                min={0}
                                value={editCap || ''}
                                onChange={(e) => setEditCap(Number(e.target.value) || 0)}
                                className="bg-slate-800 text-lg font-mono text-white outline-none w-[80px] p-1 rounded"
                                placeholder="Cap"
                            />
                            <button onClick={handleSaveArea} disabled={savingArea} className="p-2 bg-emerald-600 rounded-lg text-white hover:bg-emerald-500 disabled:opacity-50"><Save className="w-5 h-5" /></button>
                            <button onClick={() => setIsEditingArea(false)} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 group">
                            <h1 className="text-4xl font-bold text-white">{area.name}</h1>
                            {!isStaff && (
                                <button onClick={() => setIsEditingArea(true)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-white transition-all">
                                    <Pencil className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider", percentage >= 100 ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500")}>
                            {percentage >= 100 ? 'At Capacity' : 'Live'}
                        </span>
                        {capacity > 0 && <span className="text-xs text-slate-500">{percentage}% Full</span>}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full lg:w-auto">
                    <KPICard label="Occupancy" value={liveOccupancy} sub={capacity > 0 ? `/ ${capacity}` : 'No Limit'} />
                    <KPICard label="Total In" value={totalIn} color="text-emerald-400" />
                    <KPICard label="Total Out" value={totalOut} color="text-rose-400" />
                </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Assigned Clicrs
                        </h3>
                        <p className="text-sm text-slate-500">Manage monitoring points for this area</p>
                    </div>
                    {!isStaff && (
                        <button
                            onClick={() => setShowAddClicr(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold transition-colors shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add Clicr
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeDevices.map(device => (
                        <ClicrCard
                            key={device.id}
                            device={device}
                            onArchive={() => setClicrToDelete(device)}
                        />
                    ))}
                    {activeDevices.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                            No active clicrs in this area. Add one to start tracking.
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30">
                    <h3 className="text-slate-400 font-bold mb-2">Staff Assignment</h3>
                    <p className="text-xs text-slate-500">Assign specific staff members to this area&apos;s clickers coming in v2.1.</p>
                </div>
                <div className="p-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30">
                    <h3 className="text-slate-400 font-bold mb-2">Area Insights</h3>
                    <p className="text-xs text-slate-500">Hourly breakdown and peak times analysis coming in v2.1.</p>
                </div>
            </div>

            <AnimatePresence>
                {showAddClicr && (
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => !savingClicr && setShowAddClicr(false)}
                        onKeyDown={(e) => { if (e.key === 'Escape' && !savingClicr) setShowAddClicr(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="add-clicr-title"
                            className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Escape' && !savingClicr) setShowAddClicr(false); }}
                        >
                            <h2 id="add-clicr-title" className="text-xl font-bold text-white mb-4">Add New Clicr</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="clicr-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Name</label>
                                    <input
                                        id="clicr-name"
                                        type="text"
                                        value={newClicrName}
                                        onChange={e => setNewClicrName(e.target.value)}
                                        placeholder="e.g. Front Door, VIP Entrance"
                                        className="w-full bg-black border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label htmlFor="clicr-command" className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Command / Mapping (Optional)</label>
                                    <input
                                        id="clicr-command"
                                        type="text"
                                        value={newClicrCommand}
                                        onChange={e => setNewClicrCommand(e.target.value)}
                                        placeholder="e.g. DOOR_1_IN or Hardware Code"
                                        className="w-full bg-black border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Unique identifier for hardware or keyboard mapping.</p>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Flow Mode</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['IN_ONLY', 'OUT_ONLY', 'BIDIRECTIONAL'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setNewClicrFlow(mode)}
                                                className={cn(
                                                    "p-2 rounded-lg text-xs font-bold border transition-colors",
                                                    newClicrFlow === mode
                                                        ? "bg-primary/20 border-primary text-primary"
                                                        : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700"
                                                )}
                                            >
                                                {mode.replaceAll('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setShowAddClicr(false)} className="flex-1 p-3 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">Cancel</button>
                                <button
                                    type="button"
                                    onClick={handleAddClicr}
                                    disabled={savingClicr || !newClicrName.trim()}
                                    className="flex-1 p-3 rounded-lg bg-primary text-white font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingClicr ? 'Saving...' : 'Create Clicr'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {clicrToDelete && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm"
                        >
                            <h2 className="text-xl font-bold text-white mb-2">Remove Clicr?</h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Are you sure you want to remove <strong className="text-white">{clicrToDelete.name}</strong>?
                                Historical data and analytics will remain, but this device will be removed from your dashboard.
                            </p>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setClicrToDelete(null)} className="flex-1 p-3 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">Cancel</button>
                                <button
                                    type="button"
                                    onClick={confirmDeleteClicr}
                                    className="flex-1 p-3 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 font-bold hover:bg-red-500/20 hover:border-red-500/50 transition-all"
                                >
                                    Remove
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function KPICard({ label, value, sub, color = "text-white" }: { label: string; value: number; sub?: string; color?: string }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</span>
            <span className={cn("text-2xl font-mono font-bold leading-none", color)}>{value}</span>
            {sub != null && sub !== '' && <span className="text-[10px] text-slate-600 mt-1 font-mono">{sub}</span>}
        </div>
    );
}

function ClicrCard({ device, onArchive }: { device: DeviceRow; onArchive: () => void }) {
    const flowMode = device.flow_mode || 'BIDIRECTIONAL';
    let FlowIcon = ArrowRightLeft;
    let iconColor = 'text-slate-400';
    if (flowMode === 'IN_ONLY') {
        FlowIcon = LogIn;
        iconColor = 'text-emerald-500';
    } else if (flowMode === 'OUT_ONLY') {
        FlowIcon = LogOut;
        iconColor = 'text-rose-500';
    }
    return (
        <div className="bg-black/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between group hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3">
                <div className={cn('p-2 bg-slate-800 rounded-lg', iconColor)}>
                    <FlowIcon className="w-4 h-4" />
                </div>
                <div>
                    <h4 className="text-white font-bold">{device.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-slate-300">{device.current_count ?? 0}</span>
                        <span>recorded today</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/clicr/${device.id}`} className="p-2 text-primary hover:bg-primary/10 rounded-lg" title="Open Counter">
                    <ArrowRightLeft className="w-4 h-4" />
                </Link>
                <div className="h-4 w-[1px] bg-slate-700" />
                <button type="button" onClick={onArchive} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-950/30 rounded-lg transition-colors" title="Archive">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
