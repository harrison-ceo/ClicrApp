"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { Venue, Area, Clicr, Device } from '@/lib/types';
import {
    MapPin,
    Users,
    Layers,
    MonitorSmartphone,
    Plus,
    ArrowRight,
    Search,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function VenuesPage() {
    const { venues, areas, clicrs, devices, events } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

    // P0 UPDATED: Helper to calc stats using centralized metrics
    // "getVenueStats" used to sum area snapshots manually. Now we can check venueMetrics directly unless we want manual sum reliability.
    const { venueMetrics } = useApp();

    const getVenueStats = (venueId: string) => {
        // Option A: Use the VENUE METRIC (Authoritative Total)
        // This includes totals (In/Out) which were not there before.
        const metrics = venueMetrics[venueId];

        // Option B: Live Occupancy is best from SNAPSHOTS (areas array in store) if we trust it, 
        // to avoid waiting for venueMetrics RPC to refresh on every click. 
        // Our 'onEvent' update logic keeps venueMetrics.current_occupancy in sync too.
        // Let's use venueMetrics for simplicity + totals.

        // However, device counts still need manual calculation as they aren't in metrics.
        const venueAreas = areas.filter(a => a.venue_id === venueId);
        const areaIds = venueAreas.map(a => a.id);
        const venueClicrs = clicrs.filter(c => areaIds.includes(c.area_id));

        const relevantDevices = devices.filter(d =>
            d.venue_id === venueId || (d.area_id && areaIds.includes(d.area_id))
        );
        const activeDevicesCount = relevantDevices.filter(d => d.status === 'ACTIVE').length + venueClicrs.filter(c => c.active).length;

        // Fallback if metrics not loaded yet
        const currentOccupancy = metrics?.current_occupancy ?? venueAreas.reduce((sum, a) => sum + (a.current_occupancy || 0), 0);

        return {
            areaCount: venueAreas.length,
            currentOccupancy,
            totalIn: metrics?.total_in || 0,
            totalOut: metrics?.total_out || 0,
            deviceCount: activeDevicesCount
        };
    };

    const filteredVenues = venues.filter(v => {
        const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v.city && v.city.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'ALL' ||
            (statusFilter === 'ACTIVE' && v.status === 'ACTIVE') ||
            (statusFilter === 'INACTIVE' && v.status !== 'ACTIVE');
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        Venues
                    </h1>
                    <p className="text-slate-400 mt-1">Manage your locations, zones, and capacity configurations.</p>
                </div>
                <Link
                    href="/venues/new"
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-lg hover:shadow-primary/20"
                >
                    <Plus className="w-5 h-5" />
                    Add Venue
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search venues by name or city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                </div>
                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                    {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                                statusFilter === filter
                                    ? "bg-slate-800 text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-300"
                            )}
                        >
                            {filter.charAt(0) + filter.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVenues.map((venue) => {
                    const stats = getVenueStats(venue.id);
                    const capacityPct = venue.default_capacity_total
                        ? (stats.currentOccupancy / venue.default_capacity_total) * 100
                        : 0;

                    return (
                        <motion.div
                            key={venue.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 transition-all hover:bg-slate-900/60 hover:shadow-xl overflow-hidden"
                        >
                            {/* Decorative gradient blob */}
                            <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                                            {venue.name}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {venue.city ? `${venue.city}, ${venue.state}` : 'Location Unset'}
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-bold border",
                                        venue.status === 'ACTIVE'
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                            : "bg-slate-800 text-slate-400 border-slate-700"
                                    )}>
                                        {venue.status}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                                            <Users className="w-3 h-3" /> Occupancy
                                        </div>
                                        <div className="text-2xl font-bold font-mono">
                                            {stats.currentOccupancy.toLocaleString()}
                                            <span className="text-xs text-slate-500 font-sans ml-1">
                                                / {venue.default_capacity_total?.toLocaleString() ?? '∞'}
                                            </span>
                                        </div>
                                        {/* Progress Bar */}
                                        {venue.default_capacity_total && (
                                            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full",
                                                        capacityPct > 90 ? "bg-red-500" : capacityPct > 75 ? "bg-amber-500" : "bg-emerald-500"
                                                    )}
                                                    style={{ width: `${Math.min(capacityPct, 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-2 bg-slate-950/30 rounded-lg border border-slate-800/30">
                                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                                <Layers className="w-3 h-3" /> Areas
                                            </span>
                                            <span className="text-sm font-semibold">{stats.areaCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 bg-slate-950/30 rounded-lg border border-slate-800/30">
                                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                                <MonitorSmartphone className="w-3 h-3" /> Devices
                                            </span>
                                            <span className="text-sm font-semibold">{stats.deviceCount}</span>
                                        </div>
                                    </div>
                                </div>

                                <Link
                                    href={`/venues/${venue.id}`}
                                    className="flex items-center justify-between w-full p-3 bg-slate-800/50 hover:bg-slate-800 border-t border-slate-800 rounded-xl transition-colors group/btn"
                                >
                                    <span className="text-sm font-medium text-slate-300 group-hover/btn:text-white">Manage Venue</span>
                                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover/btn:text-white transition-transform group-hover/btn:translate-x-1" />
                                </Link>
                            </div>
                        </motion.div>
                    );
                })}

                {/* Add New Placeholder/Empty State if needed */}
                {filteredVenues.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500">
                        <MapPin className="w-12 h-12 mb-4 opacity-50" />
                        <p>No venues found matching your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
