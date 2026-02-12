"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, CheckCircle2, Wifi, MapPin, Layers, ArrowRight, Loader2, QrCode } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function DeviceProvisioningPage() {
    const router = useRouter();
    const { venues, areas } = useApp();

    // State
    const [step, setStep] = useState<'PAIRING' | 'FOUND' | 'CONFIG' | 'SUCCESS'>('PAIRING');
    const [pairingCode, setPairingCode] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Config State
    const [deviceName, setDeviceName] = useState('');
    const [selectedVenueId, setSelectedVenueId] = useState('');
    const [selectedAreaId, setSelectedAreaId] = useState('');
    const [deviceType, setDeviceType] = useState('Handheld Counter'); // Simulated fetch
    const [directionMode, setDirectionMode] = useState('bidirectional');

    // Filter areas based on venue
    const availableAreas = areas.filter(a => a.venue_id === selectedVenueId);

    // Handlers
    const handlePairingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pairingCode.length < 6) return;

        setIsSearching(true);
        // Simulate API lookup
        setTimeout(() => {
            setIsSearching(false);
            setStep('FOUND');
            // Pre-fill some defaults
            setDeviceName(`Clicr Device ${pairingCode.slice(-4)}`);
        }, 1500);
    };

    const handleConfigSubmit = async () => {
        // Here we would perform the actual Supabase update
        // await supabase.from('devices').update({ 
        //   device_name: deviceName, 
        //   venue_id: selectedVenueId,
        //   area_id: selectedAreaId,
        //   direction_mode: directionMode
        // }).eq('pairing_code', pairingCode);

        setStep('SUCCESS');
    };

    return (
        <div className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center p-6 -mt-8">
            <div className="w-full max-w-md">

                {/* Header Text */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Add New Device</h1>
                    <p className="text-slate-400">Pair a hardware counter or scanner to your venue.</p>
                </div>

                <AnimatePresence mode="wait">

                    {/* STEP 1: ENTER CODE */}
                    {step === 'PAIRING' && (
                        <motion.div
                            key="pairing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-[#1e2330]/50 border border-white/5 rounded-3xl p-8 backdrop-blur-sm"
                        >
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">
                                Enter 6-Digit Pairing Code
                            </label>

                            <form onSubmit={handlePairingSubmit} className="flex flex-col gap-6">
                                <input
                                    autoFocus
                                    type="text"
                                    maxLength={6}
                                    value={pairingCode}
                                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                                    placeholder="XYZ-123"
                                    className="w-full bg-black/50 border-2 border-slate-700/50 rounded-2xl p-6 text-center text-4xl font-mono font-bold text-white placeholder:text-slate-800 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase tracking-[0.5em]"
                                />

                                <div className="text-center text-xs text-slate-500">
                                    <span className="flex items-center justify-center gap-2">
                                        <QrCode className="w-4 h-4" />
                                        Don't see a code? Scan QR on device powered on screen.
                                    </span>
                                </div>

                                <button
                                    disabled={pairingCode.length < 6 || isSearching}
                                    className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Find Device'}
                                    {!isSearching && <ArrowRight className="w-5 h-5" />}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* STEP 2: FOUND & CONFIG */}
                    {(step === 'FOUND' || step === 'CONFIG') && (
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#1e2330]/50 border border-white/5 rounded-3xl p-8 backdrop-blur-sm space-y-6"
                        >
                            {/* Device Identity Card */}
                            <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                                <div className="w-12 h-12 bg-emerald-500 text-black rounded-full flex items-center justify-center shrink-0">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Device Found</div>
                                    <div className="text-white font-bold text-lg leading-none mt-1">{deviceType}</div>
                                    <div className="text-slate-500 text-xs font-mono mt-1">ID: {pairingCode} • Battery: 94%</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Device Name</label>
                                    <input
                                        type="text"
                                        value={deviceName}
                                        onChange={(e) => setDeviceName(e.target.value)}
                                        className="w-full bg-slate-900 border-none rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-primary mt-2"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <MapPin className="w-3 h-3" /> Venue
                                        </label>
                                        <select
                                            value={selectedVenueId}
                                            onChange={(e) => { setSelectedVenueId(e.target.value); setSelectedAreaId(''); }}
                                            className="w-full bg-slate-900 border-none rounded-xl p-4 text-white mt-2 appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
                                        >
                                            <option value="">Select Venue...</option>
                                            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Layers className="w-3 h-3" /> Area
                                        </label>
                                        <select
                                            value={selectedAreaId}
                                            onChange={(e) => setSelectedAreaId(e.target.value)}
                                            disabled={!selectedVenueId}
                                            className="w-full bg-slate-900 border-none rounded-xl p-4 text-white mt-2 appearance-none cursor-pointer hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Select Area...</option>
                                            {availableAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Direction Mode</label>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {[
                                            { id: 'bidirectional', label: 'Bidirectional' },
                                            { id: 'in_only', label: 'In Only' },
                                            { id: 'out_only', label: 'Out Only' }
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setDirectionMode(mode.id)}
                                                className={cn(
                                                    "py-3 rounded-xl text-sm font-bold border transition-all",
                                                    directionMode === mode.id
                                                        ? "bg-primary text-black border-primary"
                                                        : "bg-slate-900 border-transparent text-slate-400 hover:border-slate-700"
                                                )}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleConfigSubmit}
                                    disabled={!deviceName || !selectedVenueId}
                                    className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    Activate Device
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: SUCCESS */}
                    {step === 'SUCCESS' && (
                        <motion.div
                            key="success"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#1e2330]/50 border border-white/5 rounded-3xl p-8 backdrop-blur-sm text-center py-12"
                        >
                            <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">Device Active!</h2>
                            <p className="text-slate-400 max-w-xs mx-auto mb-8">
                                <span className="text-white font-bold">{deviceName}</span> is now paired to <br />
                                <span className="text-primary">{venues.find(v => v.id === selectedVenueId)?.name}</span>.
                            </p>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setStep('PAIRING'); setPairingCode(''); setDeviceName(''); }}
                                    className="flex-1 py-3 text-slate-400 hover:text-white font-bold"
                                >
                                    Add Another
                                </button>
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-slate-200"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>

            </div>
        </div>
    );
}
