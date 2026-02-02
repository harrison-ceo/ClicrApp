"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/store';
import { ScanFace, CheckCircle2, XCircle, Search, CreditCard, RotateCcw, Camera, Ban, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IDScanEvent, BanEnforcementEvent } from '@/lib/types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { parseAAMVA } from '@/lib/aamva';
import { submitScanAction } from '@/app/actions/scan';

// Mock data generator for simulation
const generateMockID = () => {
    const isUnderage = Math.random() < 0.15; // 15% chance of underage
    const age = isUnderage ? Math.floor(Math.random() * (20 - 16 + 1) + 16) : Math.floor(Math.random() * (65 - 21 + 1) + 21);
    const sex = Math.random() > 0.5 ? 'M' : 'F';
    const zip = Math.floor(Math.random() * 90000 + 10000).toString();

    // Calculate bands just for display if needed
    let age_band = '21-25';
    if (age < 21) age_band = 'Under 21';
    else if (age > 25 && age <= 30) age_band = '26-30';
    else if (age > 30 && age <= 40) age_band = '31-40';
    else if (age > 40) age_band = '41+';

    // Mock Demographics
    const eyeColors = ['BLU', 'BRO', 'GRN', 'HAZ'];
    const hairColors = ['BRO', 'BLK', 'BLN', 'RED', 'GRY'];
    const cities = ['Los Angeles', 'San Diego', 'San Francisco', 'Sacramento'];

    return {
        age,
        sex,
        zip,
        age_band,
        eyeColor: eyeColors[Math.floor(Math.random() * eyeColors.length)],
        hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
        height: `${Math.floor(Math.random() * (80 - 60) + 60)}`, // inches
        weight: `${Math.floor(Math.random() * (220 - 120) + 120)}`,
        city: cities[Math.floor(Math.random() * cities.length)],
        state: 'CA',
        idNumber: `D${Math.floor(Math.random() * 9000000 + 1000000)}`
    };
};

export default function ScannerPage() {
    // recordScan removed from useApp context because we use Server Action now
    const { venues, patrons, patronBans, recordBanEnforcement, currentUser } = useApp();
    const [selectedVenueId, setSelectedVenueId] = useState<string>(venues[0]?.id || '');
    const [isScanning, setIsScanning] = useState(false);
    const [lastScan, setLastScan] = useState<IDScanEvent | null>(null);
    const [bannedHit, setBannedHit] = useState<{ person: any, ban: any, matchType: 'HARD' | 'SOFT' } | null>(null);
    const [useCamera, setUseCamera] = useState(false);

    // Hardware scanner state
    const [scannerInput, setScannerInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus management for hardware scanner
    useEffect(() => {
        // Auto-focus on mount and when not scanning
        if (!isScanning && !lastScan && !useCamera && !bannedHit) {
            inputRef.current?.focus();
        }

        // Keep focus if user clicks away
        const handleBlur = () => {
            if (!isScanning && !lastScan && !useCamera && !bannedHit) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        };

        const inputEl = inputRef.current;
        inputEl?.addEventListener('blur', handleBlur);
        return () => inputEl?.removeEventListener('blur', handleBlur);
    }, [isScanning, lastScan, useCamera, bannedHit]);

    const handleHardwareScan = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setScannerInput(val);
    };

    const checkBan = (parsed: any) => {
        if (!parsed.firstName || !parsed.lastName) return null;

        const dobFormatted = parsed.dateOfBirth
            ? (parsed.dateOfBirth.length === 8
                ? `${parsed.dateOfBirth.substring(0, 4)}-${parsed.dateOfBirth.substring(4, 6)}-${parsed.dateOfBirth.substring(6, 8)}`
                : parsed.dateOfBirth)
            : null;

        // Find potential matches by name
        const nameMatches = patrons.filter(p =>
            p.first_name.toLowerCase() === parsed.firstName.toLowerCase() &&
            p.last_name.toLowerCase() === parsed.lastName.toLowerCase()
        );

        if (nameMatches.length === 0) return null;

        for (const person of nameMatches) {
            // Check active bans
            const activeBan = patronBans.find(b =>
                b.banned_person_id === person.id &&
                b.status === 'ACTIVE' &&
                (b.applies_to_all_locations || b.location_ids.includes(selectedVenueId))
            );

            if (!activeBan) continue;

            // Check expiry for temporary bans
            if (activeBan.ban_type === 'TEMPORARY' && activeBan.end_datetime) {
                if (new Date(activeBan.end_datetime).getTime() < Date.now()) continue;
            }

            // Determine Match Type
            // Hard Match = DOB matches exactly (and both exist)
            // Soft Match = IDs don't match, or DOB is missing in one record
            let matchType: 'HARD' | 'SOFT' = 'SOFT';

            if (person.date_of_birth && dobFormatted && person.date_of_birth === dobFormatted) {
                matchType = 'HARD';
            }
            // If explicit mismatch of known details (e.g. ID number), could skip, but for now we leave as SOFT if name matches

            return { person, ban: activeBan, matchType };
        }
        return null;
    };

    const processScanResult = (parsed: any) => {
        setIsScanning(false);
        setUseCamera(false);
        setBannedHit(null);

        // 1. Check for Ban
        const banHit = checkBan(parsed);
        if (banHit) {
            setBannedHit(banHit);
            return;
        }

        const age = parsed.age;
        const sex = parsed.sex;
        const zip = parsed.postalCode;

        const finalAge = age || 0;
        const scanResult = finalAge >= 21 ? 'ACCEPTED' : 'DENIED';

        // Determine band
        let age_band = 'Unknown';
        if (finalAge > 0) {
            if (finalAge < 21) age_band = 'Under 21';
            else if (finalAge <= 25) age_band = '21-25';
            else if (finalAge <= 30) age_band = '26-30';
            else if (finalAge <= 40) age_band = '31-40';
            else age_band = '41+';
        }

        const scanEvent: Omit<IDScanEvent, 'id' | 'timestamp'> = {
            venue_id: selectedVenueId,
            scan_result: scanResult,
            age: finalAge,
            age_band: age_band,
            sex: sex || 'U',
            zip_code: zip || '00000',
            // PII
            first_name: parsed.firstName || undefined,
            last_name: parsed.lastName || undefined,
            dob: parsed.dateOfBirth || undefined,
            id_number_last4: parsed.idNumber ? parsed.idNumber.slice(-4) : (parsed.expirationDate ? parsed.expirationDate.slice(-4) : '0000'),
            issuing_state: parsed.state || 'CA', // Use parsed state if available
            id_type: 'DRIVERS_LICENSE',

            // Advanced Demographics
            address_street: parsed.addressStreet || undefined,
            city: parsed.city || undefined,
            state: parsed.state || undefined,
            eye_color: parsed.eyeColor || undefined,
            hair_color: parsed.hairColor || undefined,
            height: parsed.height || undefined,
            weight: parsed.weight || undefined,
            id_number: parsed.idNumber || undefined
        };

        // Call Server Action
        const scanResultObj = { status: scanResult as any, message: 'Processed via Scanner' };
        submitScanAction(selectedVenueId, scanResultObj, parsed);

        // Update Local State for UI
        setLastScan({ ...scanEvent, id: 'temp', timestamp: Date.now() });
    };

    const handleBanEnforcement = (result: 'BLOCKED' | 'WARNED' | 'ALLOWED_OVERRIDE', notes?: string) => {
        if (!bannedHit) return;

        const event: BanEnforcementEvent = {
            id: Math.random().toString(36).substring(7),
            ban_id: bannedHit.ban.id,
            location_id: selectedVenueId,
            scanner_user_id: currentUser.id,
            scan_datetime: new Date().toISOString(),
            result: result,
            notes: notes,
            person_snapshot_name: `${bannedHit.person.first_name} ${bannedHit.person.last_name}`
        };

        recordBanEnforcement(event);
        setBannedHit(null);
    };

    // State for override reason modal
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');

    const submitOverride = (e: React.FormEvent) => {
        e.preventDefault();
        handleBanEnforcement('ALLOWED_OVERRIDE', overrideReason || 'Manager override');
        setIsOverrideModalOpen(false);
        setOverrideReason('');
    };

    // Helper to quick ban from scan result
    const handleQuickBan = () => {
        if (!lastScan) return;

        const params = new URLSearchParams();
        if (lastScan.first_name) params.set('fname', lastScan.first_name);
        if (lastScan.last_name) params.set('lname', lastScan.last_name);
        if (lastScan.dob) params.set('dob', lastScan.dob);
        if (lastScan.id_number_last4) params.set('id_last4', lastScan.id_number_last4);

        window.location.href = `/banning?mode=create&${params.toString()}`;
    };

    const handleHardwareSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannerInput) return;

        try {
            const parsed = parseAAMVA(scannerInput);
            console.log("Hardware Parse:", parsed);
            if (parsed.age !== null) {
                processScanResult(parsed);
            } else {
                console.warn("Invalid ID Scan or Partial Data");
            }
        } catch (err) {
            console.error("Hardware scan parse error", err);
        }

        setScannerInput('');
    };

    // Scanner simulation logic
    const handleSimulateScan = async () => {
        setIsScanning(true);
        setLastScan(null);
        setBannedHit(null);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Randomly decide to scan an existing patron (to test bans) or a random person
        const shouldPickExisting = Math.random() < 0.3 && patrons.length > 0;

        if (shouldPickExisting) {
            const randomPatron = patrons[Math.floor(Math.random() * patrons.length)];
            // Mock a scan for this person
            processScanResult({
                age: randomPatron.date_of_birth ? new Date().getFullYear() - parseInt(randomPatron.date_of_birth.substring(0, 4)) : 25,
                sex: 'M', // Mock
                postalCode: '12345',
                firstName: randomPatron.first_name,
                lastName: randomPatron.last_name,
                dateOfBirth: randomPatron.date_of_birth ? randomPatron.date_of_birth.replace(/-/g, '') : '20000101'
            });
        } else {
            const mockData = generateMockID();
            processScanResult({
                age: mockData.age,
                sex: mockData.sex,
                postalCode: mockData.zip,
                firstName: 'Random',
                lastName: 'Patron',
                dateOfBirth: '20000101',
                // Advanced Mock
                eyeColor: mockData.eyeColor,
                hairColor: mockData.hairColor,
                height: mockData.height,
                weight: mockData.weight,
                city: mockData.city,
                state: mockData.state,
                idNumber: mockData.idNumber
            });
        }
    };

    // Camera Logic
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        let timeoutId: NodeJS.Timeout;

        if (useCamera && !lastScan && !bannedHit) {
            // Wait for the DOM element to be mounted (AnimatePresence delay)
            timeoutId = setTimeout(() => {
                const elementExists = document.getElementById("reader");
                if (elementExists) {
                    try {
                        scanner = new Html5QrcodeScanner(
                            "reader",
                            { fps: 10, qrbox: { width: 250, height: 250 } },
                            false
                        );

                        scanner.render((decodedText) => {
                            try {
                                const parsed = parseAAMVA(decodedText);
                                if (parsed.age !== null) {
                                    scanner?.clear();
                                    processScanResult(parsed);
                                } else {
                                    alert("Could not detect valid ID data. Try again.");
                                }
                            } catch (e) { console.error(e); }
                        }, (error) => { });
                    } catch (e) { console.error(e); }
                }
            }, 500);
        }

        return () => {
            clearTimeout(timeoutId);
            if (scanner) {
                scanner.clear().catch(e => console.error("Failed to clear scanner", e));
            }
        };
    }, [useCamera, lastScan, bannedHit]);

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">ID Scanner</h1>
                    <p className="text-slate-400">Scan patron IDs for verification and demographics.</p>
                </div>

                {/* Venue Selector */}
                <select
                    value={selectedVenueId}
                    onChange={(e) => setSelectedVenueId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg p-3 outline-none focus:border-primary"
                >
                    {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            </div>

            {/* Main Scanner Interface */}
            <div
                className="bg-slate-900/50 glass-panel border border-slate-800 rounded-3xl p-8 min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden"
                onClick={() => !isOverrideModalOpen && inputRef.current?.focus()}
            >
                {/* Hidden Hardware Input */}
                <form onSubmit={handleHardwareSubmit} className="opacity-0 absolute top-0 left-0 w-0 h-0 overflow-hidden">
                    <input
                        ref={inputRef}
                        value={scannerInput}
                        onChange={handleHardwareScan}
                        autoFocus
                        autoComplete="off"
                        type="text"
                    />
                    <button type="submit">Scan</button>
                </form>

                {/* Override Modal */}
                {isOverrideModalOpen && (
                    <div className="absolute inset-0 bg-black/90 z-[60] flex items-center justify-center p-6 animate-in fade-in">
                        <form onSubmit={submitOverride} className="w-full max-w-sm bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl font-bold text-white mb-2">Authorize Override</h3>
                            <p className="text-slate-400 text-sm mb-4">Please provide a reason for allowing this banned patron entry.</p>

                            <label className="text-xs font-bold text-slate-500 uppercase">Reason / Manager PIN</label>
                            <input
                                autoFocus
                                required
                                value={overrideReason}
                                onChange={e => setOverrideReason(e.target.value)}
                                className="w-full bg-black border border-slate-700 rounded-lg p-3 text-white mb-6 focus:border-primary outline-none"
                                placeholder="e.g. Cleared by Manager..."
                            />

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsOverrideModalOpen(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold">Confirm Entry</button>
                            </div>
                        </form>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {bannedHit && !isOverrideModalOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                                "border-4 rounded-3xl p-8 shadow-2xl text-center w-full max-w-lg z-50 absolute",
                                bannedHit.matchType === 'HARD'
                                    ? "bg-red-950 border-red-600 shadow-red-900/50"
                                    : "bg-amber-950 border-amber-500 shadow-amber-900/50"
                            )}
                            key="banned"
                        >
                            <div className="flex justify-center mb-6">
                                <div className={cn(
                                    "p-6 rounded-full animate-pulse",
                                    bannedHit.matchType === 'HARD' ? "bg-red-600" : "bg-amber-500"
                                )}>
                                    {bannedHit.matchType === 'HARD' ? (
                                        <Ban className="w-16 h-16 text-white" />
                                    ) : (
                                        <AlertTriangle className="w-16 h-16 text-white" />
                                    )}
                                </div>
                            </div>

                            <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">
                                {bannedHit.matchType === 'HARD' ? 'BANNED' : 'POSSIBLE MATCH'}
                            </h2>
                            <p className={cn(
                                "font-bold text-lg mb-8",
                                bannedHit.matchType === 'HARD' ? "text-red-300" : "text-amber-300"
                            )}>
                                {bannedHit.matchType === 'HARD' ? 'DO NOT ADMIT' : 'VERIFY IDENTITY CAREFULLY'}
                            </p>

                            <div className={cn(
                                "bg-black/40 rounded-xl p-6 text-left space-y-4 mb-8 border",
                                bannedHit.matchType === 'HARD' ? "border-red-900/50" : "border-amber-900/50"
                            )}>
                                <div>
                                    <label className={cn("text-xs uppercase font-bold", bannedHit.matchType === 'HARD' ? "text-red-400" : "text-amber-400")}>Patron</label>
                                    <div className="text-xl text-white font-bold">{bannedHit.person.first_name} {bannedHit.person.last_name}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={cn("text-xs uppercase font-bold", bannedHit.matchType === 'HARD' ? "text-red-400" : "text-amber-400")}>DOB</label>
                                        <div className="text-white font-mono">{bannedHit.person.date_of_birth || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className={cn("text-xs uppercase font-bold", bannedHit.matchType === 'HARD' ? "text-red-400" : "text-amber-400")}>Ban Type</label>
                                        <div className="text-white">{bannedHit.ban.ban_type}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className={cn("text-xs uppercase font-bold", bannedHit.matchType === 'HARD' ? "text-red-400" : "text-amber-400")}>Reason</label>
                                    <div className="text-white font-medium">{bannedHit.ban.reason_category}</div>
                                    {bannedHit.ban.reason_notes && <div className={cn("text-sm mt-1", bannedHit.matchType === 'HARD' ? "text-red-200" : "text-amber-200")}>{bannedHit.ban.reason_notes}</div>}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                {bannedHit.matchType === 'HARD' ? (
                                    <>
                                        <button
                                            onClick={() => handleBanEnforcement('BLOCKED')}
                                            className="flex-[2] py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
                                        >
                                            Dismiss (Block)
                                        </button>
                                        <button
                                            onClick={() => setIsOverrideModalOpen(true)}
                                            className="flex-1 py-4 bg-transparent border-2 border-slate-700 text-slate-400 hover:text-white hover:border-white font-bold rounded-xl transition-colors text-sm"
                                        >
                                            Override
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleBanEnforcement('BLOCKED', 'Identity confirmed by staff')}
                                            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
                                        >
                                            Deny Entry
                                        </button>
                                        <button
                                            onClick={() => handleBanEnforcement('ALLOWED_OVERRIDE', 'Identity mismatch confirmed')}
                                            className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
                                        >
                                            Allow (Mismatch)
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {!lastScan && !useCamera && !bannedHit && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="text-center space-y-6"
                            key="ready"
                        >
                            <div className="w-48 h-32 border-2 border-dashed border-slate-600 rounded-xl mx-auto flex items-center justify-center bg-slate-800/30">
                                <CreditCard className="w-12 h-12 text-slate-500" />
                            </div>

                            <div className="grid gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Ready to Scan</h2>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Use Bluetooth Scanner <span className="text-primary font-bold">•</span> Camera <span className="text-primary font-bold">•</span> Simulation
                                    </p>
                                </div>

                                <button
                                    onClick={() => setUseCamera(true)}
                                    className="px-8 py-4 bg-primary text-white text-lg font-bold rounded-full shadow-lg shadow-primary/25 hover:bg-primary-hover hover:scale-105 transition-all flex items-center justify-center gap-3 w-64 mx-auto"
                                >
                                    <Camera className="w-6 h-6" />
                                    Scan with Camera
                                </button>

                                <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">- OR -</div>

                                <button
                                    onClick={handleSimulateScan}
                                    className="px-6 py-3 bg-slate-800 text-slate-200 text-sm font-bold rounded-full hover:bg-slate-700 transition-all flex items-center justify-center gap-2 w-48 mx-auto"
                                >
                                    <ScanFace className="w-4 h-4" />
                                    Simulate Scan
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {useCamera && !lastScan && (
                        <div className="w-full max-w-md mx-auto relative z-10" key="camera">
                            <div id="reader" className="overflow-hidden rounded-xl border-2 border-slate-700 bg-black"></div>
                            <button
                                onClick={() => setUseCamera(false)}
                                className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg mx-auto block hover:bg-slate-700"
                            >
                                Cancel Camera
                            </button>
                        </div>
                    )}

                    {isScanning && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center flex-col bg-slate-900/80 backdrop-blur-sm z-10"
                            key="scanning"
                        >
                            <div className="relative">
                                <div className="w-24 h-24 border-4 border-primary rounded-full animate-spin border-t-transparent" />
                                <Search className="absolute inset-0 m-auto text-primary w-8 h-8 animate-pulse" />
                            </div>
                            <p className="mt-4 text-primary font-mono tracking-widest uppercase text-sm">Processing ID Data...</p>
                        </motion.div>
                    )}

                    {lastScan && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-sm"
                            key="result"
                        >
                            <div className={cn(
                                "rounded-2xl p-6 border-4 text-center shadow-2xl relative overflow-hidden",
                                lastScan.scan_result === 'ACCEPTED'
                                    ? "bg-emerald-950/50 border-emerald-500 shadow-emerald-500/20"
                                    : "bg-red-950/50 border-red-500 shadow-red-500/20"
                            )}>
                                {/* Result Icon */}
                                <div className="mb-4 flex justify-center">
                                    {lastScan.scan_result === 'ACCEPTED' ? (
                                        <CheckCircle2 className="w-20 h-20 text-emerald-400" />
                                    ) : (
                                        <XCircle className="w-20 h-20 text-red-500" />
                                    )}
                                </div>

                                <h2 className={cn(
                                    "text-3xl font-black uppercase tracking-wider mb-2",
                                    lastScan.scan_result === 'ACCEPTED' ? "text-emerald-400" : "text-red-500"
                                )}>
                                    {lastScan.scan_result}
                                </h2>

                                {/* Data Grid */}
                                <div className="bg-black/20 rounded-xl p-4 mt-6 grid grid-cols-2 gap-4 text-left">
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase font-bold">Age</div>
                                        <div className="text-2xl text-white font-mono">{lastScan.age}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase font-bold">Sex</div>
                                        <div className="text-2xl text-white font-mono">{lastScan.sex}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase font-bold">Name</div>
                                        <div className="text-sm text-white font-bold truncate">{lastScan.first_name || 'N/A'} {lastScan.last_name || ''}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase font-bold">Time</div>
                                        <div className="text-sm text-white font-mono mt-1">
                                            {new Date(lastScan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-8">
                                    <button
                                        onClick={() => setLastScan(null)}
                                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Next
                                    </button>

                                    {/* Ban Button - One Tap Ban */}
                                    <button
                                        onClick={handleQuickBan}
                                        className="px-4 py-3 bg-red-950/50 hover:bg-red-900/50 border border-red-900 text-red-400 hover:text-red-300 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                                        title="Ban this Guest"
                                    >
                                        <Ban className="w-4 h-4" />
                                        Ban
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Recent Scans List Preview (Optional) */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Session Scans</h3>
                <div className="space-y-2">
                    {/* Could list recent scans here from store if needed */}
                </div>
            </div>
        </div>
    );
}
