"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Settings, Users, Plus, Pencil, Trash2,
    MoreVertical, ChevronDown, CheckCircle2, AlertCircle,
    ArrowRightLeft, LogIn, LogOut, Save, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Clicr, FlowMode } from '@/lib/types';
import Link from 'next/link';

export default function AreaDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { areas, venues, clicrs, events, updateArea, addClicr, updateClicr, isLoading } = useApp();

    const area = areas.find(a => a.id === id);
    const venue = venues.find(v => v.id === area?.venue_id);
    const areaClicrs = clicrs.filter(c => c.area_id === id);

    // Live Stats
    // Source of Truth: area.current_occupancy (Server Snapshot) > Fallback to summing clicrs if snapshot missing
    const liveOccupancy = area?.current_occupancy !== undefined
        ? area.current_occupancy
        : areaClicrs.reduce((acc, c) => acc + c.current_count, 0);

    const percentage = area?.capacity_limit ? Math.round((liveOccupancy / area.capacity_limit) * 100) : 0;

    // In/Out Today (Aggregated from all clicrs in this area)
    // We need to filter events by area_id
    const areaEvents = events.filter(e => e.area_id === id);
    const totalIn = areaEvents.reduce((acc, e) => e.flow_type === 'IN' ? acc + Math.abs(e.delta) : acc, 0);
    const totalOut = areaEvents.reduce((acc, e) => e.flow_type === 'OUT' ? acc + Math.abs(e.delta) : acc, 0);

    // States
    const [isEditingArea, setIsEditingArea] = useState(false);
    const [showAddClicr, setShowAddClicr] = useState(false);
    const [clicrToDelete, setClicrToDelete] = useState<Clicr | null>(null);

    // Edit Form State
    const [editName, setEditName] = useState('');
    const [editCap, setEditCap] = useState(0);

    // Add Clicr Form State
    const [newClicrName, setNewClicrName] = useState('');
    const [newClicrCommand, setNewClicrCommand] = useState('');
    const [newClicrFlow, setNewClicrFlow] = useState<FlowMode>('BIDIRECTIONAL');
    const [isSavingClicr, setIsSavingClicr] = useState(false);

    useEffect(() => {
        if (area) {
            setEditName(area.name);
            setEditCap(area.capacity_limit || 0);
        }
    }, [area]);

    if (isLoading) return <div className="p-8 text-white">Loading Area...</div>;
    if (!area) return <div className="p-8 text-white">Area not found</div>;

    // Handlers
    const handleSaveArea = async () => {
        if (!editName.trim()) return;
        const success = await updateArea({
            ...area,
            name: editName,
            capacity_limit: editCap > 0 ? editCap : undefined
        });
        if (success) {
            setIsEditingArea(false);
        } else {
            alert('Failed to update area');
        }
    };

    const handleAddClicr = async () => {
        if (!newClicrName.trim()) return;
        setIsSavingClicr(true);

        const success = await addClicr({
            id: crypto.randomUUID(),
            area_id: area.id,
            name: newClicrName,
            command: newClicrCommand.trim() || undefined,
            flow_mode: newClicrFlow,
            current_count: 0,
            active: true
        });

        setIsSavingClicr(false);
        if (success) {
            setShowAddClicr(false);
            setNewClicrName('');
            setNewClicrCommand('');
            setNewClicrFlow('BIDIRECTIONAL');
        } else {
            alert('Failed to save Clicr. Please try again.');
        }
    };

    // New Delete Handler
    const useAppHook = useApp as any; // Temporary cast if type update is delayed
    const { deleteClicr } = useAppHook();
    // Ideally useApp() returns properly typed object if store.tsx is updated.
    // If strict type checking fails, we might need to rely on the updated interface.
    // Let's assume useApp() is typed correctly by now.

    const confirmDeleteClicr = async () => {
        if (!clicrToDelete) return;

        // Call delete action
        const success = await deleteClicr(clicrToDelete.id);

        if (success) {
            setClicrToDelete(null); // Close modal
        } else {
            alert("Failed to remove Clicr. Please try again.");
            // Keep modal open
        }
    };

    const handleArchiveClicr = async (clicr: Clicr) => {
        if (confirm(`Archive ${clicr.name}? This will hide it from the dashboard.`)) {
            await updateClicr({ ...clicr, active: false });
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                <Link href="/areas" className="hover:text-white transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Areas
                </Link>
                <span>/</span>
                <span className="text-slate-300">{venue?.name}</span>
            </div>

            {/* Main Title & Stats Strip */}
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                <div>
                    {!isEditingArea ? (
                        <div className="flex items-center gap-3 group">
                            <h1 className="text-4xl font-bold text-white">{area.name}</h1>
                            <button onClick={() => setIsEditingArea(true)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-white transition-all">
                                <Pencil className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
                            <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-transparent text-2xl font-bold text-white outline-none w-[200px]"
                                autoFocus
                            />
                            <input
                                type="number"
                                value={editCap}
                                onChange={(e) => setEditCap(parseInt(e.target.value))}
                                className="bg-slate-800 text-lg font-mono text-white outline-none w-[80px] p-1 rounded"
                                placeholder="Cap"
                            />
                            <button onClick={handleSaveArea} className="p-2 bg-emerald-600 rounded-lg text-white hover:bg-emerald-500"><Save className="w-5 h-5" /></button>
                            <button onClick={() => setIsEditingArea(false)} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider", percentage >= 100 ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500")}>
                            {percentage >= 100 ? 'At Capacity' : 'Live'}
                        </span>
                        {area.capacity_limit && <span className="text-xs text-slate-500">{percentage}% Full</span>}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-4 w-full lg:w-auto">
                    <KPICard label="Occupancy" value={liveOccupancy} sub={area.capacity_limit ? `/ ${area.capacity_limit}` : 'No Limit'} />
                    <KPICard label="Total In" value={totalIn} color="text-emerald-400" />
                    <KPICard label="Total Out" value={totalOut} color="text-rose-400" />
                </div>
            </div>

            {/* Clicrs Management Section */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Assigned Clicrs
                        </h3>
                        <p className="text-sm text-slate-500">Manage monitoring points for this area</p>
                    </div>
                    <button
                        onClick={() => setShowAddClicr(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Add Clicr
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {areaClicrs.filter(c => c.active).map(clicr => (
                        <ClicrCard
                            key={clicr.id}
                            clicr={clicr}
                            onArchive={() => setClicrToDelete(clicr)}
                        />
                    ))}
                    {areaClicrs.filter(c => c.active).length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                            No active clicrs in this area. Add one to start tracking.
                        </div>
                    )}
                </div>
            </div>

            {/* Placeholder for Staff / Insight Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30">
                    <h3 className="text-slate-400 font-bold mb-2">Staff Assignment</h3>
                    <p className="text-xs text-slate-500">Assign specific staff members to this area's clickers coming in v2.1.</p>
                </div>
                <div className="p-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30">
                    <h3 className="text-slate-400 font-bold mb-2">Area Insights</h3>
                    <p className="text-xs text-slate-500">Hourly breakdown and peak times analysis coming in v2.1.</p>
                </div>
            </div>


            {/* Add Clicr Modal */}
            <AnimatePresence>
                {showAddClicr && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md"
                        >
                            <h2 className="text-xl font-bold text-white mb-4">Add New Clicr</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={newClicrName}
                                        onChange={e => setNewClicrName(e.target.value)}
                                        placeholder="e.g. Front Door, VIP Entrance"
                                        className="w-full bg-black border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Command / Mapping (Optional)</label>
                                    <input
                                        type="text"
                                        value={newClicrCommand}
                                        onChange={e => setNewClicrCommand(e.target.value)}
                                        placeholder="e.g. DOOR_1_IN or Hardware Code"
                                        className="w-full bg-black border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Unique identifier for hardware or keyboard mapping.</p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Flow Mode</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['IN_ONLY', 'OUT_ONLY', 'BIDIRECTIONAL'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => setNewClicrFlow(mode)}
                                                className={cn(
                                                    "p-2 rounded-lg text-xs font-bold border transition-colors",
                                                    newClicrFlow === mode
                                                        ? "bg-primary/20 border-primary text-primary"
                                                        : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700"
                                                )}
                                            >
                                                {mode.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setShowAddClicr(false)} className="flex-1 p-3 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">Cancel</button>
                                <button
                                    onClick={handleAddClicr}
                                    disabled={isSavingClicr || !newClicrName.trim()}
                                    className="flex-1 p-3 rounded-lg bg-primary text-white font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSavingClicr ? 'Saving...' : 'Create Clicr'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
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
                                <button onClick={() => setClicrToDelete(null)} className="flex-1 p-3 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">Cancel</button>
                                <button
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

function KPICard({ label, value, sub, color = "text-white" }: { label: string, value: number, sub?: string, color?: string }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</span>
            <span className={cn("text-2xl font-mono font-bold leading-none", color)}>{value}</span>
            {sub && <span className="text-[10px] text-slate-600 mt-1 font-mono">{sub}</span>}
        </div>
    )
}

function ClicrCard({ clicr, onArchive }: { clicr: Clicr, onArchive: () => void }) {
    return (
        <div className="bg-black/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between group hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                    {clicr.flow_mode === 'BIDIRECTIONAL' ? <ArrowRightLeft className="w-4 h-4" /> :
                        clicr.flow_mode === 'IN_ONLY' ? <LogIn className="w-4 h-4 text-emerald-500" /> :
                            <LogOut className="w-4 h-4 text-rose-500" />
                    }
                </div>
                <div>
                    <h4 className="text-white font-bold">{clicr.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-slate-300">{clicr.current_count}</span>
                        <span>recorded today</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/clicr/${clicr.id}`} className="p-2 text-primary hover:bg-primary/10 rounded-lg" title="Open Counter">
                    <ArrowRightLeft className="w-4 h-4" />
                </Link>
                <div className="h-4 w-[1px] bg-slate-700"></div>
                <button onClick={onArchive} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-950/30 rounded-lg transition-colors" title="Archive">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
