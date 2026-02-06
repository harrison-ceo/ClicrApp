"use client";

import React, { useEffect, useState, useRef } from 'react';

import { useApp } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings2, Plus, Minus, ScanFace, CheckCircle2, XCircle, ArrowUpCircle, ArrowDownCircle, Trash2, Layout, Link2, Unlink, ChevronDown, Check, Zap, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IDScanEvent } from '@/lib/types';
import { parseAAMVA } from '@/lib/aamva';
import { evaluateScan } from '@/lib/scan-service';
import { Html5Qrcode } from 'html5-qrcode';
import { getVenueCapacityRules } from '@/lib/capacity';
import { tokens } from '@/lib/ui/tokens';
import { MetricCard, ActionButton, OccupancyDisplay } from '@/lib/ui/components/ClicrComponents';
import { ScannerResult, ScanStatus } from '@/lib/ui/components/ScannerResult';
import { METRICS } from '@/lib/core/metrics';
import { getTodayWindow } from '@/lib/core/time';

// Mock data generator for simulation
const generateMockID = () => {
    const isUnderage = Math.random() < 0.15; // 15% chance of underage
    const age = isUnderage ? Math.floor(Math.random() * (20 - 16 + 1) + 16) : Math.floor(Math.random() * (65 - 21 + 1) + 21);
    const sex = Math.random() > 0.5 ? 'M' : 'F';
    const zip = Math.floor(Math.random() * 90000 + 10000).toString();

    let age_band = '21-25';
    if (age < 21) age_band = 'Under 21';
    else if (age > 25 && age <= 30) age_band = '26-30';
    else if (age > 30 && age <= 40) age_band = '31-40';
    else if (age > 40) age_band = '41+';

    return { age, sex, zip, age_band };
};


export default function ClicrPanel({
    clicrId,
    overrideLabel,
    className,
    showLayoutControls = false
}: {
    clicrId?: string,
    overrideLabel?: string,
    className?: string,
    showLayoutControls?: boolean
}) {
    const {
        clicrs, areas, events, venues,
        recordEvent, recordScan, recordTurnaround, renameDevice,
        resetCounts, isLoading, patrons, patronBans, updateClicr, debug, currentUser,
        turnarounds
    } = useApp();

    const id = clicrId;
    const rawClicr = (clicrs || []).find((c) => c.id === id);
    const lastClicrRef = useRef<any>(null);
    if (rawClicr) lastClicrRef.current = rawClicr;
    const clicr = rawClicr || lastClicrRef.current;
    const [showCameraScanner, setShowCameraScanner] = useState(false);

    // Flashlight State (Moved to top to avoid Hook Rule violation)
    const [torchOn, setTorchOn] = useState(false);

    // cleanup torch on unmount
    useEffect(() => {
        return () => {
            if ((window as any).localStream) {
                (window as any).localStream.getTracks().forEach((t: any) => t.stop());
            }
        };
    }, []);

    // --- SPLIT VIEW STATE ---
    // FORCED P0 RESTORE: Single view only to match demo stability.
    const [layoutMode, setLayoutMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE');
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);
    const [showSplitSetup, setShowSplitSetup] = useState(false);

    // Split Configuration
    const [splitConfig, setSplitConfig] = useState<{
        mode: 'INDEPENDENT' | 'LINKED';
        secondaryClicrId: string | null;
        primaryLabel: string;
        secondaryLabel: string;
    }>({
        mode: 'INDEPENDENT',
        secondaryClicrId: null,
        primaryLabel: 'Primary',
        secondaryLabel: 'Secondary'
    });

    // Calculate total area occupancy from SNAPSHOT (Source of Truth)
    const currentArea = (areas || []).find(a => a.id === clicr?.area_id);
    const lastOccupancyRef = useRef<number | null>(null);

    if (currentArea?.current_occupancy !== undefined) {
        lastOccupancyRef.current = currentArea.current_occupancy;
    }

    // Prevents flash to 0 if data momentarily disappears during sync
    const totalAreaCount = currentArea?.current_occupancy ?? lastOccupancyRef.current;

    // Calculate aggregated stats for the ENTIRE VENUE from SNAPSHOTS
    const venueId = currentArea?.venue_id;

    // Venue Occupancy = Sum of all areas in venue (Realtime)
    const venueAreas = (areas || []).filter(a => a.venue_id === venueId);
    const currentVenueOccupancy = venueAreas.reduce((acc, a) => acc + (a.current_occupancy || 0), 0);
    const venue = (venues || []).find(v => v.id === venueId);

    // Keep event-based stats for "Session" view if needed, but rely on snapshots for enforcement
    const venueEvents = (events || []).filter(e => e.venue_id === venueId);

    /**
     * TRAFFIC STATS (IN / OUT)
     * - Source: occupancy_events (via RPC)
     * - Scope: Filtered by Area if device is assigned, else Venue.
     */
    // TRAFFIC STATS (IN / OUT)
    // P0 UPDATED: Use centralized areaMetrics
    const { areaMetrics } = useApp();

    // Get stats for this Clicr's Area
    const metrics = clicr?.area_id ? areaMetrics[clicr.area_id] : null;

    const globalIn = metrics?.total_in;
    const globalOut = metrics?.total_out;
    // const currentOccupancy = metrics?.current_occupancy; // Use snapshot instead for latency safety

    // DEBUG PANEL STATE
    const [showDebug, setShowDebug] = useState(false);

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkValue, setBulkValue] = useState(0);

    // --- CUSTOM BUTTON LABELS ---
    const [customLabels, setCustomLabels] = useState<{ label_a: string, label_b: string }>({
        label_a: 'MALE',
        label_b: 'FEMALE'
    });
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [soloMode, setSoloMode] = useState(false);
    const [draftSoloMode, setDraftSoloMode] = useState(false);
    const [editLabels, setEditLabels] = useState<{ label_a: string, label_b: string }>({ label_a: '', label_b: '' });

    // Classification Mode State
    const [classifyMode, setClassifyMode] = useState(false);
    const [showScanBreakdown, setShowScanBreakdown] = useState(false);
    const [pendingScan, setPendingScan] = useState<IDScanEvent | null>(null);

    // Scanner State
    const [lastScan, setLastScan] = useState<IDScanEvent | null>(null);
    const [scannerInput, setScannerInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Track modal state via ref to avoid listener re-binding
    const isModalOpenRef = useRef(false);
    useEffect(() => {
        isModalOpenRef.current = showBulkModal || showConfigModal;
    }, [showBulkModal, showConfigModal]);

    // Force focus when modals close
    useEffect(() => {
        if (!showBulkModal && !showConfigModal) {
            const timer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [showBulkModal, showConfigModal]);

    // Focus management for hardware scanner
    useEffect(() => {
        // Global keydown listener to catch hardware scans even if focus is lost
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check ref to see if we should ignore (modal open)
            if (isModalOpenRef.current) return;

            // Ignore if user is typing in a real input field (like bulk modal)
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' && target !== inputRef.current) return;

            // If input is not focused, refocus it and append the key
            if (document.activeElement !== inputRef.current) {
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // Initial focus
        const timer = setTimeout(() => inputRef.current?.focus(), 100);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };

    }, []); // Run once on mount! Stable listener.

    useEffect(() => {
        const handleBlur = () => {
            if (!showBulkModal && !showConfigModal) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        };
        const inputEl = inputRef.current;
        inputEl?.addEventListener('blur', handleBlur);
        return () => inputEl?.removeEventListener('blur', handleBlur);
    }, [showBulkModal, showConfigModal]);


    // Load from local storage or Server on mount/update
    useEffect(() => {
        // Prioritize SERVER config for sync
        if (clicr?.button_config) {
            setCustomLabels(clicr.button_config);
        } else {
            // Fallback to local if server has nothing (legacy)
            const saved = localStorage.getItem(`clicr_config_${id}`);
            if (saved) {
                try {
                    setCustomLabels(JSON.parse(saved));
                } catch (e) { console.error("Failed to parse saved config"); }
            }
        }

        // Load Layout Mode
        const savedMode = localStorage.getItem(`clicr_layout_mode_${id}`);
        if (savedMode === 'SOLO') {
            setSoloMode(true);
        }

        // Load Classify Mode
        const savedClassify = localStorage.getItem(`clicr_classify_mode_${id}`);
        if (savedClassify === 'true') {
            setClassifyMode(true);
        }
    }, [id, clicr]);

    const [editName, setEditName] = useState('');

    // ... (keep existing state hooks) ...

    const saveConfig = async (name: string, a: string, b: string) => {
        const newLabels = { label_a: a.toUpperCase(), label_b: b.toUpperCase() };
        setCustomLabels(newLabels);

        // Save to Local Storage (Legacy/Offline backup)
        localStorage.setItem(`clicr_config_${id}`, JSON.stringify(newLabels));

        // Save to Server (Syncs to other devices)
        if (clicr) {
            await updateClicr({
                ...clicr,
                name: name,
                button_config: newLabels
            });
        }

        setShowConfigModal(false);
    };

    // ...

    // if (isLoading) return <div className="p-8 text-white">Connecting...</div>;
    // if (!clicr) return <div className="p-8 text-white">Clicr not found</div>;

    const handleGenderTap = (gender: 'M' | 'F', delta: number) => {
        if (!clicr || !venueId) return;
        // ENFORCEMENT CHECK
        if (delta > 0) {
            const { maxCapacity: maxCap, mode } = getVenueCapacityRules(venue);

            if (maxCap > 0 && currentVenueOccupancy >= maxCap) {
                if (mode === 'HARD_STOP') {
                    alert("CAPACITY REACHED: Entry Blocked (Hard Stop Active)");
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    return; // BLOCK
                }
                if (mode === 'MANAGER_OVERRIDE' || mode === 'HARD_BLOCK' as any) { // Handle variations
                    // Require confirmation
                    if (!window.confirm("WARNING: Capacity Reached. Authorize Override?")) {
                        return; // BLOCK if not confirmed
                    }
                }
                if (mode === 'WARN_ONLY') {
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50]);
                    // Optional: Toast warning
                }
            }
        }

        if (navigator.vibrate) navigator.vibrate(50);

        // If we have a pending classification, clearing it is the priority
        // We assume this tap IS the classification for that scan
        if (pendingScan && delta > 0) {
            // Count it!
            setPendingScan(null);
            setLastScan(null); // Clear the visual overlay too
        }

        // 1. Record the Count Event (Changes Occupancy) with Gender
        recordEvent({
            venue_id: venueId,
            area_id: clicr.area_id,
            clicr_id: clicr.id,
            delta: delta,
            flow_type: delta > 0 ? 'IN' : 'OUT',
            gender: gender,
            event_type: 'TAP', // Ideally 'SCAN_CLASSIFIED' but keeping simple for now
            idempotency_key: Math.random().toString(36)
        });

        // 2. If it's an entry (Delta > 0), also log a "Scan" for the record
        // (Optional: remove this if we rely solely on events for graph, but good for ID log consistency)
        // NOTE: In classify mode, scan is already logged upstream. In normal mode, we might double log if not careful.
        // But the previous requirement was "log a Scan" here. 
        // Improvement: Only record scan HERE if it wasn't already recorded by the scanner process.
        // However, for consistency with existing codebase, let's keep it simple.
        // The upstream 'recordScan' logs the physical scan. This 'recordScan' here seems to be simulating a scan for manual taps?
        // Actually, looking at original code: "If delta > 0... also log a Scan". This implies manual taps generate artificial scan records?
        // Let's preserve existing logic for manual taps, but AVOID it if we just processed a real scan (to avoid double scan logs).

        if (delta > 0 && !pendingScan) {
            recordScan({
                venue_id: venueId,
                scan_result: 'ACCEPTED',
                age: 21,
                age_band: '21+',
                sex: gender,
                zip_code: '00000'
            });
        }
    };

    const handleBulkSubmit = () => {
        if (!clicr || !venueId) return;
        if (bulkValue !== 0) {
            recordEvent({
                venue_id: venueId,
                area_id: clicr.area_id,
                clicr_id: clicr.id,
                delta: bulkValue,
                // Always attribute corrections to 'IN' flow as requested
                flow_type: 'IN',
                event_type: 'BULK',
                idempotency_key: Math.random().toString(36)
            });
            setBulkValue(0);
            setShowBulkModal(false);
        }
    };

    // Reset Logic
    const handleReset = async () => {
        if (!window.confirm('WARNING: RESET ALL COUNTS TO ZERO?')) return;
        if (!venueId) return;

        try {
            await resetCounts('VENUE', venueId);
            setBulkValue(0);
            setLastScan(null);
            setScannerInput('');
        } catch (e) {
            console.error("Reset failed", e);
            alert("Failed to reset. Please try again or check connection.");
        }
    };

    // --- ADVANCED SCANNER LOGIC ---
    // (Hooks moved to top)

    // Unified Scan Processor (The Brain)

    // Unified Scan Processor (The Brain)
    // Unified Scan Processor (The Brain)
    const processScan = async (parsed: ReturnType<typeof parseAAMVA>, rawData?: string) => {
        if (!venueId) return;
        // 1. API Verification (Preferred for Hardware Scans)
        if (rawData) {
            try {
                const res = await fetch('/api/verify-id', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scan_data: rawData,
                        business_id: venue?.business_id,
                        venue_id: venueId,
                        area_id: clicr?.area_id
                    })
                });

                const json = await res.json();

                if (json.success) {
                    const { status, message, age, dob, name } = json.data;

                    const scanEvent: any = {
                        venue_id: venueId || '',
                        scan_result: status,
                        age: age,
                        age_band: age >= 21 ? '21+' : 'Under 21',
                        sex: 'U', // API enhancement needed for Sex if crucial
                        zip_code: '00000',
                        uiMessage: message,
                        timestamp: Date.now()
                    };

                    setLastScan(scanEvent);

                    // Haptic Feedback
                    if (status === 'ACCEPTED') {
                        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    } else {
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    }
                    setShowCameraScanner(false);
                    return; // API handled everything
                }
            } catch (e) {
                console.error("API Scan Failed, falling back to local", e);
            }
        }

        // 2. Fallback (Simulation or API Failure or Manual Parsing)
        // We use the NEW scan-service logic here
        const result = evaluateScan(parsed, patrons, patronBans, venueId);

        // ... Local Logic (Same as before) ...
        const scanEvent: Omit<IDScanEvent, 'id' | 'timestamp'> = {
            venue_id: venueId,
            scan_result: result.status === 'ACCEPTED' ? 'ACCEPTED' : 'DENIED',
            age: result.age || 0,
            age_band: result.age ? (result.age >= 21 ? '21+' : 'Under 21') : 'Unknown',
            sex: parsed.sex || 'U',
            zip_code: parsed.postalCode || '00000',
            first_name: parsed.firstName || undefined,
            last_name: parsed.lastName || undefined,
            dob: parsed.dateOfBirth || undefined,
            id_number: parsed.idNumber || undefined,
            issuing_state: parsed.state || undefined,
            address_street: parsed.addressStreet || undefined,
            city: parsed.city || undefined
        };

        recordScan(scanEvent);

        setLastScan({
            ...scanEvent,
            id: 'temp',
            timestamp: Date.now(),
            uiMessage: result.message
        } as any);

        if (result.status === 'ACCEPTED') {
            if (classifyMode) {
                setPendingScan({ ...scanEvent, id: 'temp_pending', timestamp: Date.now() } as any);
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            } else {
                // Check Capacity Locally if fallback
                if (venue) {
                    const maxCap = venue.default_capacity_total || 0;
                    if (maxCap > 0 && currentVenueOccupancy >= maxCap) {
                        alert("CAPACITY REACHED");
                        return;
                    }
                }

                recordEvent({
                    venue_id: venueId,
                    area_id: clicr?.area_id || 'area_001',
                    clicr_id: clicr?.id || 'dev_001',
                    delta: 1,
                    flow_type: 'IN',
                    gender: parsed.sex || 'M',
                    event_type: 'SCAN',
                    idempotency_key: Math.random().toString(36)
                });
                if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
            }
        } else {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
        setShowCameraScanner(false);
    };

    // Hardware Scanner Input Handler (Keyboard Wedge)
    const handleHardwareSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannerInput) return;
        try {
            console.log("Processing Hardware Scan...");
            const parsed = parseAAMVA(scannerInput);
            processScan(parsed, scannerInput); // Pass Raw String!
        } catch (err) {
            console.error("Scan Parse Error", err);
            alert("Failed to parse ID. Please try again.");
        }
        setScannerInput('');
    };

    // Simulation Handler
    const handleSimulateScan = () => {
        // Create a random mock ID but structurally correct for parsing helper
        const mock = generateMockID();
        // Since we need ParsedID structure, let's just make a fake one compatible with logic
        const fakeParsed = {
            firstName: 'Sim',
            lastName: 'User',
            dateOfBirth: mock.age < 21 ? '20100101' : '19900101',
            sex: mock.sex as any,
            postalCode: mock.zip,
            expirationDate: '20300101',
            age: mock.age,
            isExpired: false,
            // ... fields needed for ban check logic
            idNumber: `SIM${Math.floor(Math.random() * 10000)}`,
            state: 'CA',
            addressStreet: null, city: null, eyeColor: null, hairColor: null, height: null, weight: null
        };
        processScan(fakeParsed);
    };

    const handleCameraScan = (decodedText: string) => {
        try {
            console.log("Camera Scan Success");
            const parsed = parseAAMVA(decodedText);
            processScan(parsed, decodedText);
        } catch (e) {
            console.error("Camera scan invalid data", e);
        }
    };

    // --- SPLIT VIEW HELPERS ---
    const activateSplit = (mode: 'INDEPENDENT' | 'LINKED') => {
        if (!clicr) return;
        setSplitConfig(prev => ({ ...prev, mode }));
        setShowLayoutMenu(false);
        // If we haven't set up yet, show setup
        if (mode === 'INDEPENDENT' && !splitConfig.secondaryClicrId) {
            setShowSplitSetup(true);
        } else if (mode === 'LINKED') {
            // Auto-setup for linked
            setSplitConfig(prev => ({
                ...prev,
                mode: 'LINKED',
                primaryLabel: 'ENTRY',
                secondaryLabel: 'EXIT',
                secondaryClicrId: clicr.id // Self ref for logic
            }));
            setLayoutMode('SPLIT');
        } else {
            setLayoutMode('SPLIT');
        }
    };



    // Flashlight Toggle Function
    const toggleTorch = async () => {
        try {
            if (torchOn) {
                // Turn OFF
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                const track = stream.getVideoTracks()[0];
                await track.applyConstraints({ advanced: [{ torch: false }] as any });
                track.stop(); // Stop stream to release camera
                setTorchOn(false);
            } else {
                // Turn ON
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                const track = stream.getVideoTracks()[0];
                // Check if torch is supported
                const capabilities = track.getCapabilities() as any;
                if (!capabilities.torch) {
                    alert("Flashlight not supported on this device.");
                    track.stop();
                    return;
                }
                await track.applyConstraints({ advanced: [{ torch: true }] as any });
                // We must keep the track alive for torch to stay on? 
                // Usually yes. We'll store it in a ref if strictly needed, but let's see if simple track active works.
                // Actually, stopping the track turns off the torch usually.
                // So we need to KEEP the stream active. 
                // But we don't want to show the video element if we just want the torch.
                // So we just hold the stream in a ref.
                (window as any).localStream = stream; // Hacky globals or just let it float? better use Ref.
                setTorchOn(true);
            }
        } catch (err) {
            console.error("Flashlight error", err);
            alert("Could not access flashlight. Ensure camera permissions are granted.");
            setTorchOn(false);
        }
    };

    // Debounce Scanner Input (Wait for scanner to finish dumping string)
    useEffect(() => {
        if (!scannerInput) return;
        const timeout = setTimeout(() => {
            if (scannerInput.length > 10) { // Minimal length check
                console.log("Processing Hardware Scan (Debounced)...");
                try {
                    const parsed = parseAAMVA(scannerInput);
                    // Only process if we actually got something useful
                    if (parsed.firstName || parsed.idNumber || parsed.city) {
                        processScan(parsed);
                        setScannerInput(''); // Clear after success
                    }
                } catch (err) {
                    // Silent fail if it's just garbage input, otherwise alert?
                    // console.warn("Parse attempt failed", err);
                }
            }
        }, 300); // 300ms wait after last character
        return () => clearTimeout(timeout);
    }, [scannerInput]);

    if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-slate-500 animate-pulse">Connecting...</div>;

    // Robust check: If clicr missing but we have ID, maybe wait a bit or show helpful error
    if (!clicr) {
        // Fallback: This might happen during a hard sync or if the device was just added/removed.
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-slate-400 gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="text-sm">Syncing Device State...</div>
                {/* Hidden debug info just in case */}
                <div className="hidden">ID: {id}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100vh] bg-black relative overflow-hidden" onClick={() => inputRef.current?.focus()}>
            {/* Hidden Input */}
            <textarea
                ref={inputRef as any}
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                className="opacity-0 absolute top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none"
                autoFocus
                autoComplete="off"
            />

            {/* UI LAYER - PIXEL MATCH */}
            <div className="flex flex-col h-full relative z-10">

                {/* 1. Header */}
                <header className="flex justify-between items-start pt-8 pb-4 px-6 shrink-0">
                    <div>
                        <h2 className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">
                            {venue?.name || 'VENUE'}
                        </h2>
                        <div className="flex items-center gap-2">
                            <h1 className="text-white font-bold text-2xl tracking-tight">
                                {overrideLabel || clicr.name}
                            </h1>
                            {/* Rename Trigger (Subtle) */}
                            <button onClick={() => setShowConfigModal(true)} className="opacity-0 hover:opacity-50 transition-opacity">
                                <Settings2 className="w-4 h-4 text-slate-600" />
                            </button>
                        </div>
                    </div>
                    {/* Status Dot */}
                    <div className="flex gap-4 items-center">
                        <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]",
                            isLoading ? "bg-yellow-500" : "bg-[#00C853]"
                        )} />
                    </div>
                </header>

                {/* 2. Main Occupancy */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                    <OccupancyDisplay
                        count={totalAreaCount}
                        capacity={(currentArea?.capacity_max || venue?.default_capacity_total) || undefined}
                        percent={
                            (currentArea?.capacity_max || venue?.default_capacity_total) && totalAreaCount !== undefined && totalAreaCount !== null
                                ? Math.round((totalAreaCount || 0) / (currentArea?.capacity_max || venue?.default_capacity_total || 1) * 100)
                                : undefined
                        }
                    />
                </div>

                {/* 3. Stats Row & Turnarounds */}
                <div className="flex flex-col gap-2 px-6 mb-6 shrink-0">
                    <div className="grid grid-cols-3 gap-3">
                        <MetricCard label="TOTAL IN" value={globalIn || 0} />
                        <MetricCard label="NET" value={totalAreaCount || 0} />
                        <MetricCard label="TOTAL OUT" value={globalOut || 0} />
                    </div>

                    {/* Turnaround & Adjusted Net Row (P0) */}
                    <div className="grid grid-cols-3 gap-3">
                        <div /> {/* Spacer */}
                        <div className="bg-slate-900/50 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5 cursor-pointer" onClick={() => setShowScanBreakdown(!showScanBreakdown)}>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">NET (ADJ)</span>
                            {/* Placeholder logic until store updates propagate */}
                            <span className="text-white font-mono font-bold">
                                {(totalAreaCount || 0) - (turnarounds.filter(t => t.area_id === clicr.area_id).reduce((a, b) => a + b.count, 0) || 0)}
                            </span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5 active:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => {
                                if (navigator.vibrate) navigator.vibrate(50);
                                recordTurnaround(venueId || '', clicr.area_id, clicr.id, 1);
                            }}
                        >
                            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">TURNAROUND</span>
                            <span className="text-purple-300 font-mono font-bold">+</span>
                        </div>
                    </div>

                    {/* Scan Breakdown (P0) */}
                    {showScanBreakdown && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-slate-950 rounded-md border border-slate-800 p-2 text-xs text-slate-400 flex justify-between px-4 mt-1">
                            <span>Manual: <span className="text-white font-bold">--</span></span>
                            <span>Scans: <span className="text-white font-bold">--</span></span>
                            <span>Turns: <span className="text-white font-bold">{turnarounds.filter(t => t.area_id === clicr.area_id).reduce((a, b) => a + b.count, 0)}</span></span>
                        </motion.div>
                    )}
                </div>

                {/* 4. Action Buttons */}
                <div className="flex flex-col gap-3 px-6 pb-8 shrink-0">
                    <ActionButton
                        label={customLabels.label_a || "GUEST IN"}
                        onClick={() => handleGenderTap('M', 1)}
                        className="h-24 md:h-28 text-lg"
                        icon={<div className="mb-[-4px]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
                    />

                    {/* Only show OUT if bidirectional */}
                    {(clicr.direction_mode !== 'in_only') && (
                        <ActionButton
                            label="GUEST OUT"
                            variant="out"
                            onClick={() => handleGenderTap('M', -1)}
                            className="h-24 md:h-28 text-lg bg-[#1E3A8A] hover:bg-[#1E40AF]"
                            icon={<div className="mb-[-4px]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12H19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
                        />
                    )}
                </div>
            </div>

            {/* SCANNER OVERLAY (Absolute z-50) */}
            <AnimatePresence>
                {lastScan && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="absolute inset-0 z-50"
                    >
                        <ScannerResult
                            status={
                                lastScan.scan_result === 'ACCEPTED' ? 'ALLOWED' :
                                    lastScan.scan_result === 'DENIED' && ((lastScan as any).uiMessage?.includes('BANNED') || (lastScan as any).reason === 'BANNED') ? 'DENIED_BANNED' :
                                        'DENIED_UNDERAGE'
                            }
                            data={{
                                name: `${lastScan.first_name || 'GUEST'} ${lastScan.last_name || ''}`,
                                age: lastScan.age || 0,
                                dob: lastScan.dob || 'Unknown',
                                exp: 'Valid',
                            }}
                            onScanNext={() => setLastScan(null)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Debug / Config Access (Hidden or Subtle) */}
            <div className="absolute top-8 right-6 z-20 opacity-0 hover:opacity-100 transition-opacity">
                <button onClick={() => setShowConfigModal(true)}><Settings2 className="text-slate-700 w-6 h-6" /></button>
            </div>

            {/* CAMERA SCANNER MODAL */}
            <AnimatePresence>
                {showCameraScanner && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4"
                    >
                        <div className="absolute top-4 right-4 z-20">
                            <button
                                onClick={() => setShowCameraScanner(false)}
                                className="p-4 bg-slate-900 rounded-full text-white"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <CameraScanner onScan={handleCameraScan} />

                        <div className="absolute bottom-12 text-center text-slate-500 text-sm">
                            Align ID barcode within the frame
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SPLIT SETUP MODAL */}
            <AnimatePresence>
                {showSplitSetup && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-6"
                        >
                            <div>
                                <h3 className="text-xl font-bold text-white">Setup Split View</h3>
                                <p className="text-slate-400 text-sm">Select another counter to display alongside {clicr.name}.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Counter</label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {clicrs.filter(c => c.id !== clicr.id).map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSplitConfig(prev => ({ ...prev, secondaryClicrId: c.id, secondaryLabel: c.name }))}
                                            className={cn(
                                                "w-full p-3 rounded-xl border flex items-center justify-between transition-all",
                                                splitConfig.secondaryClicrId === c.id
                                                    ? "bg-primary/20 border-primary text-white"
                                                    : "bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-800/80"
                                            )}
                                        >
                                            <span className="font-bold">{c.name}</span>
                                            {splitConfig.secondaryClicrId === c.id && <Check className="w-4 h-4 text-primary" />}
                                        </button>
                                    ))}
                                    {clicrs.length <= 1 && <div className="text-slate-500 italic p-2">No other counters available.</div>}
                                </div>
                            </div>

                            <button
                                disabled={!splitConfig.secondaryClicrId}
                                onClick={() => setShowSplitSetup(false)}
                                className="w-full py-4 bg-primary rounded-xl text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm Split View
                            </button>
                            <button onClick={() => { setLayoutMode('SINGLE'); setShowSplitSetup(false); }} className="w-full py-2 text-slate-500 text-xs font-bold uppercase tracking-widest">Cancel</button>

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Bulk Modal (Reference Design Match) */}
            <AnimatePresence>
                {showBulkModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0f1218] border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl space-y-6"
                        >
                            <h3 className="text-xl font-bold text-white text-center">Adjust Counts</h3>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setBulkValue(v => v - 1)}
                                    className="w-12 h-12 flex items-center justify-center bg-[#1e2330] rounded-xl text-white hover:bg-[#2a3040] active:scale-95 transition-all text-xl font-medium"
                                >
                                    <Minus className="w-5 h-5" />
                                </button>

                                <div className="flex-1 bg-black border border-slate-800 rounded-xl h-12 flex items-center px-4">
                                    <input
                                        type="number"
                                        value={bulkValue}
                                        onChange={(e) => setBulkValue(parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent text-center text-xl font-bold text-white outline-none"
                                    />
                                </div>

                                <button
                                    onClick={() => setBulkValue(v => v + 1)}
                                    className="w-12 h-12 flex items-center justify-center bg-[#1e2330] rounded-xl text-white hover:bg-[#2a3040] active:scale-95 transition-all text-xl font-medium"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setShowBulkModal(false); setBulkValue(0); }}
                                    className="py-3 rounded-xl text-slate-400 bg-[#1e2330] hover:bg-[#2a3040] font-semibold text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkSubmit}
                                    className="py-3 rounded-xl bg-[#6366f1] text-white font-semibold text-sm hover:bg-[#4f46e5] shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                                >
                                    Apply
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CONFIG MODAL */}
            <AnimatePresence>
                {showConfigModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0f1218] border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl space-y-6"
                        >
                            <div>
                                <h3 className="text-xl font-bold text-white">Clicr Settings</h3>
                                <p className="text-slate-500 text-sm">Customize your counter interface.</p>
                            </div>

                            {/* Counter Name Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Counter Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-white transition-colors"
                                    placeholder="e.g. Main Entrance"
                                />
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-white/5">
                                <span className="text-sm font-bold text-white">Dual Counter Mode</span>
                                <button
                                    id="mode_toggle"
                                    onClick={(e) => {
                                        // Toggle local draft only - prevents background thrashing
                                        setDraftSoloMode(!draftSoloMode);
                                    }}
                                    className={cn("w-12 h-7 rounded-full relative transition-colors",
                                        !draftSoloMode ? "bg-blue-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform" style={{ transform: !draftSoloMode ? "translateX(20px)" : "translateX(0px)" }} />
                                </button>
                            </div>

                            {/* Classify Toggle */}
                            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-white/5">
                                <span className="text-sm font-bold text-white">Classify Scans</span>
                                <button
                                    onClick={() => {
                                        const newVal = !classifyMode;
                                        setClassifyMode(newVal);
                                        localStorage.setItem(`clicr_classify_mode_${clicr.id}`, String(newVal));
                                    }}
                                    className={cn("w-12 h-7 rounded-full relative transition-colors",
                                        classifyMode ? "bg-emerald-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform" style={{ transform: classifyMode ? "translateX(20px)" : "translateX(0px)" }} />
                                </button>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                                {/* Input A (Always visible) */}
                                <div className="space-y-2">
                                    <label className={cn("text-xs font-bold uppercase tracking-widest transition-colors",
                                        draftSoloMode ? "text-white" : "text-blue-400"
                                    )}>
                                        {draftSoloMode ? "Button Label" : "Left Button (Blue)"}
                                    </label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={editLabels.label_a}
                                        onChange={(e) => setEditLabels(prev => ({ ...prev, label_a: e.target.value }))}
                                        className={cn("w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none transition-colors",
                                            draftSoloMode ? "focus:border-white" : "focus:border-blue-500"
                                        )}
                                        placeholder={draftSoloMode ? "e.g. COUNT" : "e.g. MALE"}
                                    />
                                </div>

                                {/* Input B (Hidden in Solo) */}
                                <div className={cn("space-y-2 transition-all duration-200 overflow-hidden",
                                    draftSoloMode ? "h-0 opacity-0 pointer-events-none" : "h-auto opacity-100"
                                )}>
                                    <label className="text-xs font-bold text-pink-400 uppercase tracking-widest">Right Button (Pink)</label>
                                    <input
                                        type="text"
                                        value={editLabels.label_b}
                                        onChange={(e) => setEditLabels(prev => ({ ...prev, label_b: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-pink-500 transition-colors"
                                        placeholder="e.g. FEMALE"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        // Just close, discard draft
                                        setShowConfigModal(false);
                                    }}
                                    className="py-3 rounded-xl text-slate-400 bg-[#1e2330] hover:bg-[#2a3040] font-semibold text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        // Save Logic
                                        // Commit draft to real state
                                        const isSolo = draftSoloMode;
                                        setSoloMode(isSolo);

                                        let a = editLabels.label_a || (isSolo ? 'COUNT' : 'MALE');
                                        let b = editLabels.label_b || 'FEMALE';

                                        saveConfig(editName, a, b);

                                        if (isSolo) {
                                            localStorage.setItem(`clicr_layout_mode_${clicr.id}`, 'SOLO');
                                        } else {
                                            localStorage.removeItem(`clicr_layout_mode_${clicr.id}`);
                                        }
                                    }}
                                    className="py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-slate-200 shadow-lg transition-all active:scale-95"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* DEBUG PANEL - OWNER ONLY */}
            <AnimatePresence>
                {showDebug && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        className="fixed inset-y-0 right-0 w-80 bg-slate-950 border-l border-slate-800 p-6 z-[200] overflow-y-auto shadow-2xl"
                    >
                        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                            <Bug className="w-5 h-5 text-indigo-400" />
                            Sync Debugger
                        </h3>

                        <div className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Context</label>
                                <div className="text-xs text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800 break-all">
                                    UID: {currentUser?.id}<br />
                                    BIZ: {venue?.business_id}<br />
                                    VEN: {venueId}<br />
                                    AREA: {clicr?.area_id}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Snapshot Truth</label>
                                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-2xl font-bold flex items-center justify-between">
                                    {currentArea ? currentArea.current_occupancy : 'N/A'}
                                    <span className="text-[10px] text-emerald-600 uppercase">Server State</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Realtime Status</label>
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", debug?.realtimeStatus === 'SUBSCRIBED' ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                                    <span className="text-sm text-white font-mono">{debug?.realtimeStatus || 'UNKNOWN'}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Last 5 Writes</label>
                                <div className="space-y-2">
                                    {debug?.lastWrites?.map((w: any, i: number) => (
                                        <div key={i} className="bg-slate-900 p-2 rounded text-[10px] font-mono border border-slate-800">
                                            <div className={cn("font-bold mb-1", w.type === 'RPC_SUCCESS' ? "text-emerald-400" : "text-red-400")}>
                                                {w.type}
                                            </div>
                                            <div className="text-slate-400 truncate">
                                                {JSON.stringify(w.payload)}
                                            </div>
                                        </div>
                                    ))}
                                    {!debug?.lastWrites?.length && <div className="text-xs text-slate-600 italic">No writes yet</div>}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Last 5 Events</label>
                                <div className="space-y-2">
                                    {debug?.lastEvents?.map((e: any, i: number) => (
                                        <div key={i} className="bg-slate-900 p-2 rounded text-[10px] font-mono border border-slate-800">
                                            <div className="text-indigo-400 font-bold mb-1">{e.eventType}</div>
                                            <div className="text-slate-400 break-all">
                                                {JSON.stringify(e.new || e.old)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}


// --- HELPER COMPONENTS ---

function SplitCounterPart({
    clicrId,
    label,
    color,
    mode,
    role,
    onTap,
    currentCount
}: {
    clicrId: string | null,
    label: string,
    color: 'blue' | 'pink' | 'red', // red for exit
    mode: 'INDEPENDENT' | 'LINKED',
    role: 'PRIMARY' | 'SECONDARY',
    onTap: (delta: number) => void,
    currentCount: number
}) {
    if (!clicrId && mode === 'INDEPENDENT') return <div className="flex-1 bg-slate-900/50 rounded-2xl flex items-center justify-center text-slate-500">No Counter Selected</div>;

    // Gradient definitions
    const gradients = {
        blue: "from-blue-600 to-blue-800 border-blue-500/30",
        pink: "from-pink-600 to-pink-800 border-pink-500/30",
        red: "from-rose-600 to-rose-800 border-rose-500/30", // For Exit
    };

    const bgGradient = gradients[color] || gradients.blue;

    return (
        <div className={cn("flex-1 rounded-2xl relative overflow-hidden flex flex-col border p-1", "bg-slate-900 border-white/5")}>

            {/* Background Hint (Label) */}
            <div className="absolute top-4 left-4 z-10">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{mode === 'LINKED' ? (role === 'PRIMARY' ? 'Entry' : 'Exit') : 'Area'}</div>
                <div className="text-lg font-bold text-white leading-none">{label}</div>
            </div>

            {/* Count Display */}
            <div className="absolute top-4 right-4 z-10 text-right">
                <div className="text-4xl font-mono font-bold text-white tabular-nums leading-none">{currentCount}</div>
            </div>

            {/* Split interaction zone */}
            <div className="flex-1 flex gap-1 mt-12">
                {/* Minus Button (Small) */}
                <button
                    onClick={() => onTap(-1)}
                    className="w-20 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 rounded-xl flex items-center justify-center transition-colors border border-white/5"
                >
                    <Minus className="w-8 h-8 text-white/50" />
                </button>

                {/* Plus/Main Action Button (Large) */}
                <motion.button
                    onClick={() => onTap(1)}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                        "flex-1 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg relative overflow-hidden group border-t border-white/20",
                        bgGradient
                    )}
                >
                    <div className="scale-150 group-active:scale-125 transition-transform duration-100">
                        {role === 'SECONDARY' && mode === 'LINKED' ? (
                            <Plus className={cn("w-12 h-12 text-white/90 drop-shadow-md rotate-45")} />
                        ) : (
                            <Plus className="w-12 h-12 text-white/90 drop-shadow-md" />
                        )}
                    </div>
                </motion.button>
            </div>


        </div>
    );
}


function TapButton({
    type,
    label,
    color,
    onClick,
    className
}: {
    type: 'plus' | 'minus',
    label?: string,
    color?: 'blue' | 'pink',
    onClick: () => void,
    className?: string
}) {
    // Colors
    const blueGradient = "bg-blue-600 active:bg-blue-700 from-blue-600 to-blue-800 bg-gradient-to-br border-blue-500/50";
    const pinkGradient = "bg-pink-600 active:bg-pink-700 from-pink-600 to-pink-800 bg-gradient-to-br border-pink-500/50";
    // Fallback for generic
    const greenGradient = "bg-emerald-600 active:bg-emerald-700 from-emerald-600 to-emerald-800 bg-gradient-to-br";
    const redGradient = "bg-rose-600 active:bg-rose-700 from-rose-600 to-rose-800 bg-gradient-to-br";

    let bgClass = "";
    if (color === 'blue') bgClass = blueGradient;
    else if (color === 'pink') bgClass = pinkGradient;
    else bgClass = type === 'plus' ? greenGradient : redGradient;

    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center relative overflow-hidden group transition-all shadow-2xl border-t border-white/20",
                bgClass,
                className
            )}
        >
            <div className="relative z-10 flex flex-col items-center gap-1">
                {type === 'plus' ? (
                    <Plus className={cn("text-white drop-shadow-md transition-all", label ? "w-10 h-10 md:w-14 md:h-14" : "w-12 h-12 md:w-16 md:h-16")} />
                ) : (
                    <Minus className="w-6 h-6 md:w-10 md:h-10 text-white drop-shadow-md transition-all" />
                )}
                {label && <span className="text-white font-bold tracking-widest text-xs md:text-base uppercase">{label}</span>}
            </div>

            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        </motion.button>
    )
}

function CameraScanner({ onScan }: { onScan: (text: string) => void }) {
    const [torch, setTorch] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [status, setStatus] = useState<'INIT' | 'SCANNING' | 'ERROR'>('INIT');

    useEffect(() => {
        // Init Scanner
        const config = { fps: 10, qrbox: { width: 300, height: 200 } };
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                // PDF417 is critical for ID cards
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        onScan(decodedText);
                    },
                    (errorMessage) => {
                        // ignore failures, they happen on every frame
                    }
                );
                setStatus('SCANNING');
            } catch (err) {
                console.error("Camera Start Error", err);
                setStatus('ERROR');
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => scannerRef.current?.clear());
            }
        };
    }, []);

    const toggleTorch = async () => {
        if (!scannerRef.current) return;
        try {
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: !torch } as any]
            });
            setTorch(!torch);
        } catch (err) {
            console.error("Torch Error", err);
            // alert("Flashlight not available on this device."); // Optional
        }
    };

    return (
        <div className="relative w-full h-[400px] bg-black">
            {/* Scanner Box */}
            <div id="reader" className="w-full h-full" />

            {/* Overlay UI */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                <button
                    onClick={toggleTorch}
                    className={cn(
                        "p-4 rounded-full transition-all border",
                        torch
                            ? "bg-yellow-500/20 border-yellow-500 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                            : "bg-slate-900/80 border-white/10 text-white"
                    )}
                >
                    {torch ? <Zap className="w-6 h-6 fill-current" /> : <Zap className="w-6 h-6" />}
                </button>
            </div>

            {status === 'ERROR' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-6 text-center">
                    <p>Camera access failed. Please ensure permissions are granted and you are on a mobile device.</p>
                </div>
            )}
        </div>
    );
}


