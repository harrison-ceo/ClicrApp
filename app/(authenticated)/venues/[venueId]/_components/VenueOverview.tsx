"use client";

import React, { useMemo } from 'react';
import { useApp } from '@/lib/store';
import { Area, Venue } from '@/lib/types';
import {
    Users,
    Layers,
    MonitorSmartphone,
    Plus,
    Settings,
    LogIn,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KpiCard } from '@/components/ui/KpiCard';
import { getVenueCapacityRules } from '@/lib/capacity';
import { AreaChart, Area as RechartsArea, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function VenueOverview({ venueId, setActiveTab }: { venueId: string, setActiveTab: (tab: any) => void }) {
    const { venues, areas, clicrs, devices, events } = useApp();
    const venue = venues.find(v => v.id === venueId);

    // Filtered Data
    const venueAreas = useMemo(() => areas.filter(a => a.venue_id === venueId), [areas, venueId]);
    const areaIds = useMemo(() => venueAreas.map(a => a.id), [venueAreas]);
    const venueClicrs = useMemo(() => clicrs.filter(c => areaIds.includes(c.area_id)), [clicrs, areaIds]);

    // Live Stats (Source of truth: Area Snapshots)
    const currentOccupancy = venueAreas.reduce((sum, a) => sum + (a.current_occupancy || 0), 0);

    const { maxCapacity } = getVenueCapacityRules(venue);
    const capacityPct = maxCapacity
        ? (currentOccupancy / maxCapacity) * 100
        : 0;

    // Traffic Stats (Source of truth: Server Synced Stats on Area)
    const trafficStats = useMemo(() => {
        const ins = venueAreas.reduce((sum, a) => sum + (a.current_traffic_in || 0), 0);
        const outs = venueAreas.reduce((sum, a) => sum + (a.current_traffic_out || 0), 0);
        return { ins, outs };
    }, [venueAreas]);

    // Chart Data (Last 6 Hours) - Breakdown by Gender
    const chartData = useMemo(() => {
        if (events.length === 0) {
            return [
                { time: '10PM', male: 40, female: 60 },
                { time: '11PM', male: 90, female: 110 },
                { time: '12AM', male: 150, female: 150 },
                { time: '1AM', male: 180, female: 220 },
                { time: '2AM', male: 140, female: 210 },
                { time: '3AM', male: 60, female: 90 },
            ];
        }

        const sortedEvents = events.filter(e => e.venue_id === venueId).sort((a, b) => a.timestamp - b.timestamp);
        const now = Date.now();
        const points = [];

        for (let i = 5; i >= 0; i--) {
            const timePoint = new Date(now - i * 3600000);
            timePoint.setMinutes(59, 59, 999);

            let m = 0, f = 0, u = 0;
            sortedEvents.forEach(e => {
                if (e.timestamp <= timePoint.getTime()) {
                    if (e.gender === 'M') m += e.delta;
                    else if (e.gender === 'F') f += e.delta;
                    else u += e.delta;
                }
            });

            // Clamp
            if (m < 0) m = 0;
            if (f < 0) f = 0;
            if (u < 0) u = 0;

            const hour = timePoint.getHours();
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;

            points.push({
                time: `${hour12}${ampm}`,
                male: m,
                female: f,
                unknown: u,
                occupancy: m + f + u // For reference
            });
        }
        return points;
    }, [events, venueId]);


    if (!venue) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Live Occupancy"
                    value={currentOccupancy}
                    icon={Users}
                    trend={currentOccupancy > 0 ? 'up' : 'neutral'}
                    className="bg-slate-900/50 border-slate-800"
                />
                <KpiCard
                    title="Entries (Today)"
                    value={trafficStats.ins}
                    icon={LogIn}
                    className="bg-slate-900/50 border-slate-800 text-emerald-400"
                />
                <KpiCard
                    title="Exits (Today)"
                    value={trafficStats.outs}
                    icon={LogOut}
                    className="bg-slate-900/50 border-slate-800 text-amber-400"
                />
                <div onClick={() => setActiveTab('AREAS')} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <Layers className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-slate-500">View Areas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{venueAreas.length}</div>
                    <div className="text-xs text-slate-400 mt-1">Active Zones</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-6">Demographics Flow</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorMale" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorFemale" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <RechartsArea
                                    type="monotone"
                                    dataKey="male"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorMale)"
                                    name="Male"
                                    stackId="1"
                                />
                                <RechartsArea
                                    type="monotone"
                                    dataKey="female"
                                    stroke="#ec4899"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorFemale)"
                                    name="Female"
                                    stackId="1"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column: Quick Actions & Top Areas */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <h3 className="text-slate-400 text-sm font-medium mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => setActiveTab('AREAS')}
                                className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors text-left"
                            >
                                <Plus className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-slate-300">Add New Area</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('DEVICES')}
                                className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors text-left"
                            >
                                <MonitorSmartphone className="w-4 h-4 text-purple-400" />
                                <span className="text-sm font-medium text-slate-300">Assign Device</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('SETTINGS')}
                                className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors text-left"
                            >
                                <Settings className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-medium text-slate-300">Edit Venue Settings</span>
                            </button>
                        </div>
                    </div>

                    {/* Top Areas List (Compact) */}
                    <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Area Status</h3>
                        <div className="space-y-4">
                            {venueAreas.slice(0, 5).map(area => {
                                const areaCount = area.current_occupancy || 0;
                                const areaCap = area.default_capacity;
                                const areaPct = areaCap ? (areaCount / areaCap) * 100 : 0;

                                return (
                                    <div key={area.id}>
                                        <div className="flex justify-between items-center mb-1 text-sm">
                                            <span className="font-medium text-slate-200">{area.name}</span>
                                            <span className="text-slate-500">{areaCount} <span className="text-slate-700">/ {areaCap || '∞'}</span></span>
                                        </div>
                                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all",
                                                    areaPct > 90 ? "bg-red-500" : areaPct > 75 ? "bg-amber-500" : "bg-primary"
                                                )}
                                                style={{ width: `${Math.min(areaPct, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {venueAreas.length === 0 && <p className="text-slate-600 text-xs italic">No areas configured.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
