"use client";

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useApp } from '@/lib/store';
import ClicrPanel from './ClicrPanel';
import { Grid, Square } from 'lucide-react';

export default function ClicrPage() {
    const { id } = useParams(); // Start with URL param as default primary
    const { deviceLayouts, currentUser, upsertDeviceLayout, clicrs, isLoading } = useApp();

    // 1. Determine User's Layout Preference
    const myLayout = deviceLayouts.find(l => l.owner_user_id === currentUser?.id);
    const mode = myLayout?.layout_mode || 'single';

    // 2. Resolve Devices
    // Primary: Configured > URL Param
    const primaryId = myLayout?.primary_device_id || (typeof id === 'string' ? id : undefined);
    // Secondary: Configured > First available other
    let secondaryId = myLayout?.secondary_device_id;

    // Auto-pick secondary if missing and requested
    if (mode === 'dual' && !secondaryId && clicrs.length > 1) {
        secondaryId = clicrs.find(c => c.id !== primaryId)?.id;
    }

    // 3. Layout Toggle Action
    const toggleLayout = () => {
        const newMode = mode === 'single' ? 'dual' : 'single';
        // Persist preference
        // Ensure we have IDs selected
        let pId = primaryId;
        let sId = secondaryId || clicrs.find(c => c.id !== pId)?.id;

        if (pId) {
            upsertDeviceLayout(newMode, pId, sId || null);
        }
    };

    if (isLoading && !primaryId) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-slate-500">Loading Configuration...</div>;
    }

    if (mode === 'dual') {
        return (
            <div className="flex flex-col h-[100vh] bg-black">
                {/* Top Half (Primary) */}
                <div className="flex-1 relative border-b border-white/10 min-h-0">
                    <ClicrPanel
                        clicrId={primaryId}
                        className="h-full"
                        showLayoutControls={true}
                    />
                    {/* Overlay Toggle Button */}
                    <div className="absolute top-8 right-16 z-30">
                        <button onClick={toggleLayout} className="p-1 opacity-50 hover:opacity-100 text-white transition-opacity">
                            <Square className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Bottom Half (Secondary) */}
                <div className="flex-1 relative min-h-0">
                    {secondaryId ? (
                        <ClicrPanel
                            clicrId={secondaryId}
                            className="h-full"
                            showLayoutControls={false}
                            overrideLabel={myLayout?.secondary_label}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                            <span>No Secondary Counter Selected</span>
                            <div className="flex flex-wrap gap-2 justify-center px-6">
                                {clicrs.filter(c => c.id !== primaryId).map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => upsertDeviceLayout('dual', primaryId!, c.id)}
                                        className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-white border border-white/10 hover:bg-slate-700"
                                    >
                                        Select {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Single Mode
    return (
        <div className="h-[100vh] relative bg-black">
            <ClicrPanel
                clicrId={primaryId}
                className="h-full"
                showLayoutControls={true}
            />
            {/* Overlay Toggle Button (Top Right) */}
            <div className="absolute top-8 right-16 z-30">
                <button onClick={toggleLayout} className="p-1 opacity-50 hover:opacity-100 text-white transition-opacity">
                    <Grid className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
