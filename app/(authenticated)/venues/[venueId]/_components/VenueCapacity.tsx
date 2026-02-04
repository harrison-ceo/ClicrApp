"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { CapacityOverride, Venue } from '@/lib/types';
import {
    Shield,
    AlertTriangle,
    Calendar,
    Plus,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function VenueCapacity({ venueId }: { venueId: string }) {
    const { venues, capacityOverrides, addCapacityOverride, updateVenue } = useApp();
    const venue = venues.find(v => v.id === venueId);

    // Filter overrides for this venue (and active/future only?)
    const overrides = capacityOverrides.filter(o => o.venue_id === venueId);

    const [localCapacity, setLocalCapacity] = useState(venue?.default_capacity_total || 0);
    const [localMode, setLocalMode] = useState<any>(venue?.capacity_enforcement_mode || 'WARN_ONLY');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // RESTORED STATE
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [newOverride, setNewOverride] = useState<Partial<CapacityOverride>>({
        venue_id: venueId,
        capacity_value: 0
    });

    if (!venue) return null;

    const handleSaveOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOverride.capacity_value || !newOverride.start_datetime || !newOverride.end_datetime) return;

        const override: CapacityOverride = {
            id: Math.random().toString(36).substring(7),
            venue_id: venueId,
            start_datetime: newOverride.start_datetime,
            end_datetime: newOverride.end_datetime,
            capacity_value: newOverride.capacity_value,
            reason: newOverride.reason || '',
            created_by_user_id: 'usr_owner', // current user mock
            created_at: new Date().toISOString(),
            area_id: newOverride.area_id || null
        };

        await addCapacityOverride(override);
        setIsOverrideModalOpen(false);
        setNewOverride({ venue_id: venueId, capacity_value: 0 });
    };

    // Sync local state when venue updates (initial load or external change)
    // BUT only if not currently editing (to avoid jumping). 
    // Actually, for "Persistence" checks, simple useEffect is fine.
    React.useEffect(() => {
        if (!isSaving) {
            setLocalCapacity(venue.default_capacity_total || 0);
            setLocalMode(venue.capacity_enforcement_mode);
        }
    }, [venue.default_capacity_total, venue.capacity_enforcement_mode, isSaving]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        setSaveMessage(null);

        console.log("CAPACITY SAVE payload", {
            id: venue.id,
            total: localCapacity,
            mode: localMode
        });

        try {
            await updateVenue({
                ...venue,
                default_capacity_total: localCapacity,
                capacity_enforcement_mode: localMode
            });
            // Since updateVenue is void/async in store, we assume it throws if fails, 
            // OR we need to check if the store state actually updated?
            // The store implementation updates optimistic, then API. 
            // Ideally updateVenue should return a promise that rejects on API specific failure.

            setSaveMessage({ type: 'success', text: 'Capacity settings saved.' });

            // Clear message after 3s
            setTimeout(() => setSaveMessage(null), 3000);

        } catch (error) {
            console.error("CAPACITY SAVE error", error);
            setSaveMessage({ type: 'error', text: 'Failed to save settings.' });

            // Log to app_errors
            try {
                await fetch('/api/log-error', {
                    method: 'POST',
                    body: JSON.stringify({
                        feature: 'capacity_rules_save',
                        error_message: (error as Error).message,
                        venue_id: venueId
                    })
                });
            } catch (e) { /* ignore log fail */ }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Top Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Default Limits</h3>
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl h-full flex flex-col justify-between">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Venue Wide Max Capacity</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        value={localCapacity}
                                        onChange={(e) => setLocalCapacity(parseInt(e.target.value) || 0)}
                                        className="w-40 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 font-mono text-white text-2xl font-bold focus:border-primary focus:outline-none"
                                    />
                                    <span className="text-sm text-slate-500 font-medium">Max Guests</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    This is the baseline capacity when no overrides are active.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Enforcement Logic</h3>
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">When Capacity Is Reached</label>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { id: 'WARN_ONLY', label: 'Warn Only', desc: 'Alert staff but allow entry.' },
                                { id: 'HARD_STOP', label: 'Hard Stop', desc: 'Block entry scanning. Manager PIN required.' },
                                { id: 'MANAGER_OVERRIDE', label: 'Manager Override', desc: 'Block entry. Manager can override per strict count.' },
                            ].map(mode => (
                                <div
                                    key={mode.id}
                                    onClick={() => setLocalMode(mode.id)}
                                    className={cn(
                                        "p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4",
                                        localMode === mode.id
                                            ? "bg-primary border-primary shadow-lg shadow-primary/25"
                                            : "bg-slate-950 border-slate-800 hover:bg-slate-900"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                        localMode === mode.id ? "border-white" : "border-slate-600"
                                    )}>
                                        {localMode === mode.id && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                    </div>
                                    <div>
                                        <div className={cn("font-bold text-sm", localMode === mode.id ? "text-white" : "text-slate-300")}>
                                            {mode.label}
                                        </div>
                                        <div className={cn("text-xs mt-0.5", localMode === mode.id ? "text-white/80" : "text-slate-500")}>
                                            {mode.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Section */}
            <div className="flex items-center justify-end gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
                {saveMessage && (
                    <div className={cn("text-sm font-medium animate-in fade-in slide-in-from-right-2",
                        saveMessage.type === 'success' ? "text-emerald-400" : "text-red-400"
                    )}>
                        {saveMessage.text}
                    </div>
                )}

                <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-900 hover:bg-slate-100 font-bold py-2.5 px-6 rounded-full transition-all shadow-lg flex items-center gap-2"
                >
                    {isSaving ? <span className="animate-spin text-xl">⟳</span> : <Shield className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : 'Save Capacity Rules'}
                </button>
            </div>

            {/* Overrides Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold">Capacity Overrides</h3>
                        <p className="text-sm text-slate-400">Temporary adjustments for special events.</p>
                    </div>
                    <button
                        onClick={() => setIsOverrideModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
                    >
                        <Plus className="w-4 h-4" />
                        Create Override
                    </button>
                </div>

                <div className="space-y-3">
                    {overrides.length === 0 && (
                        <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No active or upcoming overrides.</p>
                        </div>
                    )}
                    {overrides.map(override => (
                        <div key={override.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="bg-slate-800 text-slate-300 text-xs inline-block px-1.5 py-0.5 rounded mb-1">
                                        {new Date(override.start_datetime).toLocaleDateString()}
                                    </div>
                                    <div className="font-bold text-white">
                                        {override.capacity_value} Max Capacity
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {override.reason || 'No reason provided'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right text-sm text-slate-500">
                                {new Date(override.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(override.end_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isOverrideModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsOverrideModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold mb-4">Create Capacity Override</h2>
                            <form onSubmit={handleSaveOverride} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Override Capacity</label>
                                    <input
                                        type="number"
                                        value={newOverride.capacity_value}
                                        onChange={e => setNewOverride(prev => ({ ...prev, capacity_value: parseInt(e.target.value) || 0 }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white text-2xl font-mono"
                                        placeholder="e.g. 600"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            value={newOverride.start_datetime || ''}
                                            onChange={e => setNewOverride(prev => ({ ...prev, start_datetime: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">End Time</label>
                                        <input
                                            type="datetime-local"
                                            value={newOverride.end_datetime || ''}
                                            onChange={e => setNewOverride(prev => ({ ...prev, end_datetime: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Reason (Optional)</label>
                                    <input
                                        type="text"
                                        value={newOverride.reason || ''}
                                        onChange={e => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                                        placeholder="e.g. Special Event: DJ Night"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsOverrideModalOpen(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-lg shadow-primary/20"
                                    >
                                        Set Override
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
