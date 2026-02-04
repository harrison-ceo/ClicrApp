"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { Area, AreaType, CountingMode } from '@/lib/types';
import {
    Plus,
    Edit2,
    Trash2,
    Shield,
    Smartphone,
    MoreHorizontal,
    Move
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function VenueAreas({ venueId }: { venueId: string }) {
    const { areas, addArea, updateArea } = useApp();
    const venueAreas = areas.filter(a => a.venue_id === venueId);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<Partial<Area> | null>(null);

    const handleCreate = () => {
        setEditingArea({
            venue_id: venueId,
            name: '',
            area_type: 'MAIN',
            default_capacity: 0,
            counting_mode: 'BOTH',
            is_active: true
        });
        setIsEditModalOpen(true);
    };

    const handleEdit = (area: Area) => {
        setEditingArea({ ...area });
        setIsEditModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingArea || !editingArea.name) return;

        if (editingArea.id) {
            // Update
            await updateArea(editingArea as Area);
        } else {
            // Create
            const newArea: Area = {
                ...editingArea,
                id: Math.random().toString(36).substring(7),
                venue_id: venueId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as Area;
            await addArea(newArea);
        }
        setIsEditModalOpen(false);
        setEditingArea(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Venue Areas</h2>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Area
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {venueAreas.length === 0 && (
                    <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                        <p className="text-slate-500">No areas configured yet. Add one to start tracking occupancy.</p>
                    </div>
                )}

                {venueAreas.map(area => (
                    <div
                        key={area.id}
                        className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group"
                    >
                        <div className="text-slate-600 cursor-grab active:cursor-grabbing">
                            <Move className="w-5 h-5" />
                        </div>

                        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                            {area.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white">{area.name}</h3>
                                {area.area_type && (
                                    <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 uppercase tracking-wider">
                                        {area.area_type}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 mt-2 w-full max-w-[200px]">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className={cn(
                                        "font-bold",
                                        (area.current_occupancy || 0) >= (area.default_capacity || 0) && (area.default_capacity || 0) > 0 ? "text-red-400" : "text-slate-300"
                                    )}>
                                        {area.current_occupancy || 0} / {area.default_capacity || '∞'}
                                    </span>
                                    <span className="text-slate-500">
                                        {(area.default_capacity || 0) > 0 ? `${Math.round(((area.current_occupancy || 0) / area.default_capacity!) * 100)}%` : '-'}
                                    </span>
                                </div>
                                {(area.default_capacity || 0) > 0 && (
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full transition-all duration-500",
                                                ((area.current_occupancy || 0) / area.default_capacity!) > 0.9 ? "bg-red-500" : "bg-primary"
                                            )}
                                            style={{ width: `${Math.min(((area.current_occupancy || 0) / area.default_capacity!) * 100, 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleEdit(area)}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            {/* Archive/Delete (Mock) */}
                            <button className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

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
                                    <label className="text-sm font-medium text-slate-400">Area Name</label>
                                    <input
                                        type="text"
                                        value={editingArea?.name}
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
                                            value={editingArea?.area_type}
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
                                            value={editingArea?.default_capacity || ''}
                                            onChange={e => setEditingArea(prev => ({ ...prev, default_capacity: parseInt(e.target.value) || 0 }))}
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
                                        className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-lg shadow-primary/20"
                                    >
                                        Save Area
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
