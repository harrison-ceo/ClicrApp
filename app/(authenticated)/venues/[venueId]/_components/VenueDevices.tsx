"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { Device, Clicr } from '@/lib/types';
import {
    MonitorSmartphone,
    Smartphone,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming utils exists

export default function VenueDevices({ venueId }: { venueId: string }) {
    const { devices, clicrs, areas, addDevice, updateDevice } = useApp();
    const venueDevices = (devices || []).filter(d => d.venue_id === venueId);
    const venueClicrs = (clicrs || []).filter(c => (areas || []).find(a => a.id === c.area_id)?.venue_id === venueId);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    // Mock "Add Device" just adds a mock device for now
    const handleAddMockDevice = async () => {
        const newDevice: Device = {
            id: Math.random().toString(36).substring(7),
            business_id: 'biz_001',
            venue_id: venueId,
            area_id: null, // Unassigned area initially
            device_type: 'SCANNER',
            device_name: 'New Scanner',
            serial_number: `SN-${Math.floor(Math.random() * 10000)}`,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await addDevice(newDevice);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Connected Devices</h2>
                    <p className="text-slate-400 text-sm">Manage hardware assigned to this venue.</p>
                </div>
                <button
                    onClick={handleAddMockDevice}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Register Device
                </button>
            </div>

            {/* Smart Devices List */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Scanners & Smart Counters</h3>
                {venueDevices.length === 0 && (
                    <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                        <MonitorSmartphone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">No smart devices registered.</p>
                    </div>
                )}
                {venueDevices.map(device => {
                    const assignedArea = areas.find(a => a.id === device.area_id);
                    return (
                        <div key={device.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    device.device_type === 'SCANNER' ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                                )}>
                                    {device.device_type === 'SCANNER' ? <Smartphone className="w-5 h-5" /> : <MonitorSmartphone className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="font-bold text-white flex items-center gap-2">
                                        {device.device_name}
                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                                            {device.serial_number}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className={cn(
                                            "flex items-center gap-1",
                                            device.status === 'ACTIVE' ? "text-emerald-500" : "text-amber-500"
                                        )}>
                                            {device.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                            {device.status}
                                        </span>
                                        <span>•</span>
                                        <span>{assignedArea ? `Assigned to: ${assignedArea.name}` : 'Unassigned (Venue Wide)'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-slate-300">
                                    Configure
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legacy Clicrs List */}
            {venueClicrs.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Legacy Counters (Clicr V1)</h3>
                    {venueClicrs.map(clicr => {
                        const area = areas.find(a => a.id === clicr.area_id);
                        return (
                            <div key={clicr.id} className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                                        <RefreshCw className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-300">{clicr.name}</div>
                                        <div className="text-xs text-slate-500">
                                            Legacy ID: {clicr.id} • Assigned to: {area?.name || 'Unknown'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-mono font-bold text-white">{clicr.current_count}</div>
                                    <div className="text-xs text-slate-500">Current Count</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
