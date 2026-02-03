'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, ShieldCheck, Zap, Smartphone, CheckCircle, XCircle, AlertTriangle, FileSpreadsheet, FileText, Download, Calendar, ArrowRight, RotateCcw, Building2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types & Mock Data ---

type Step = 'INTRO' | 'OCCUPANCY' | 'SCANNING' | 'BANNING' | 'REPORTING' | 'CTA';

const STEPS: { id: Step; label: string }[] = [
    { id: 'INTRO', label: 'Welcome' },
    { id: 'OCCUPANCY', label: 'Live Counts' },
    { id: 'SCANNING', label: 'ID Scanning' },
    { id: 'BANNING', label: 'Banning' },
    { id: 'REPORTING', label: 'Analytics' },
    { id: 'CTA', label: 'Get Started' }
];

const MOCK_IDS = {
    valid: { name: 'Sarah Jenkins', age: 24, dob: '1999-05-12', exp: '2028-01-01', status: 'VALID', city: 'Austin, TX' },
    underage: { name: 'Mike Ross', age: 19, dob: '2004-08-20', exp: '2026-05-15', status: 'UNDERAGE', city: 'Houston, TX' },
    expired: { name: 'John Doe', age: 28, dob: '1995-11-02', exp: '2023-10-10', status: 'EXPIRED', city: 'Dallas, TX' },
    banned: { name: 'Alex Trouble', age: 26, dob: '1997-03-15', exp: '2027-12-12', status: 'BANNED', city: 'San Antonio, TX' },
};

// --- Main Component ---

export default function InteractiveDemoPage() {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const step = STEPS[currentStepIndex].id;

    // -- Occupancy State --
    const [occupancy, setOccupancy] = useState(482);
    const [capacity] = useState(650);
    const [syncPulse, setSyncPulse] = useState(false);
    const [autoAddEnabled, setAutoAddEnabled] = React.useState(true);

    // Reporting Demo State
    const [dateRange, setDateRange] = React.useState<'24H' | '7D' | '30D'>('24H');
    const [visibleSeries, setVisibleSeries] = React.useState({ current: true, previous: true });

    const toggleSeries = (series: 'current' | 'previous') => {
        setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }));
    };

    const exportCSV = () => {
        const data = getChartData(dateRange);
        let csvContent = "Time,Foot Traffic\n";
        data.forEach(row => {
            csvContent += `${row.time},${row.value}\n`;
        });
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, "clicr_demo_report.csv");
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text("CLICR Venue Report", 20, 20);
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

        const data = getChartData(dateRange).map(r => [r.time, r.value]);

        autoTable(doc, {
            head: [['Time', 'Foot Traffic']],
            body: data,
            startY: 40,
        });

        doc.save("clicr_demo_report.pdf");
    };

    // -- Scanner State --
    const [scanResult, setScanResult] = useState<any>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [bannedList, setBannedList] = useState<string[]>(['Alex Trouble']);

    // -- Banning Interaction State --
    const [showBanModal, setShowBanModal] = useState(false);
    const [tempBanTarget, setTempBanTarget] = useState<any>(null);

    // -- Reporting State --
    const [compareMode, setCompareMode] = useState(false);

    // -- Simulation Effects --
    useEffect(() => {
        // Simulate random entry/exit sync events
        const interval = setInterval(() => {
            if (step === 'OCCUPANCY' || step === 'INTRO') {
                const change = Math.random() > 0.6 ? 1 : 0; // mostly static, sometimes +1
                if (change !== 0) {
                    setOccupancy(prev => prev + change);
                    triggerSync();
                }
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [step]);

    const triggerSync = () => {
        setSyncPulse(true);
        setTimeout(() => setSyncPulse(false), 1000);
    };

    const handleNext = () => {
        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const handleRestart = () => {
        setCurrentStepIndex(0);
        setOccupancy(482);
        setScanResult(null);
        setBannedList(['Alex Trouble']);
    };

    // -- Renderers --

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
            {/* Nav */}
            <nav className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="https://clicr.co" className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Exit Demo
                    </Link>
                    <div className="flex items-center gap-4">
                        {/* Progress Dots */}
                        <div className="hidden md:flex items-center gap-2">
                            {STEPS.map((s, i) => (
                                <div key={s.id} className={`h-2 rounded-full transition-all duration-300 ${i === currentStepIndex ? 'w-8 bg-primary' : 'w-2 bg-slate-800'}`} />
                            ))}
                        </div>
                        <div className="text-sm font-bold text-slate-300">
                            {STEPS[currentStepIndex].label} <span className="text-slate-600 font-normal">({currentStepIndex + 1}/{STEPS.length})</span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-6 md:p-12 min-h-[calc(100vh-64px)] flex flex-col">

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col"
                    >
                        {step === 'INTRO' && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                                <div className="p-6 bg-primary/10 rounded-full border border-primary/20 animate-pulse">
                                    <Zap className="w-12 h-12 text-primary" />
                                </div>
                                <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                                    Experience <span className="text-primary">CLICR</span>
                                </h1>
                                <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
                                    Take a 60-second interactive tour of the only platform that combines live occupancy showing, ID scanning, and banning into one synced system.
                                </p>
                                <button
                                    onClick={handleNext}
                                    className="group bg-white text-black px-8 py-4 rounded-full text-lg font-bold hover:scale-105 transition-all flex items-center gap-2"
                                >
                                    Start Interactive Tour <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}

                        {step === 'OCCUPANCY' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center h-full">
                                <div className="space-y-6">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold uppercase tracking-wider">
                                        <div className={`w-2 h-2 rounded-full bg-green-500 ${syncPulse ? 'animate-ping' : ''}`} />
                                        Live Sync Active
                                    </div>
                                    <h2 className="text-4xl font-bold">Real-time Occupancy</h2>
                                    <p className="text-lg text-slate-400">
                                        Track capacity across multiple areas. When door staff click '+' on their device, your dashboard updates instantly.
                                    </p>
                                    <div className="p-6 bg-slate-900 border border-white/10 rounded-2xl space-y-4">
                                        <div className="flex justify-between items-center text-sm text-slate-400">
                                            <span>Simulating 3 Active Devices</span>
                                            {syncPulse && <span className="text-primary animate-pulse">Syncing...</span>}
                                        </div>
                                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-500" style={{ width: `${(occupancy / capacity) * 100}%` }} />
                                        </div>
                                        <div className="text-xs text-center text-slate-500">Updates automatically when simulation runs</div>
                                    </div>
                                    <button onClick={handleNext} className="border border-white/20 hover:bg-white/5 text-white py-3 px-6 rounded-lg transition-colors font-bold w-full md:w-auto">Next: ID Scanning</button>
                                </div>

                                <div className="relative mx-auto w-full max-w-[400px]">
                                    {/* Phone Frame */}
                                    <div className="bg-black border-[12px] border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden aspect-[9/19] relative">
                                        {/* Dynamic Screen Content */}
                                        <div className="absolute inset-0 bg-slate-950 flex flex-col text-center">
                                            <div className="p-6 pt-12 bg-slate-900 flex justify-between items-center">
                                                <div className="font-bold text-white">Main Floor</div>
                                                <div className="text-xs font-mono text-green-400 flex items-center gap-1">● LIVE</div>
                                            </div>
                                            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-2">
                                                <div className="text-8xl font-black tabular-nums tracking-tighter text-white transition-all scale-100 duration-100">
                                                    {occupancy}
                                                </div>
                                                <div className="text-slate-500 font-bold uppercase tracking-widest text-sm">Guests / {capacity}</div>
                                                <div className="text-xs text-slate-600 mt-2">{(occupancy / capacity * 100).toFixed(0)}% Full</div>
                                            </div>
                                            <div className="grid grid-cols-2 h-1/3 border-t border-white/10">
                                                <button
                                                    onClick={() => { setOccupancy(p => p - 1); triggerSync(); }}
                                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-500 text-6xl font-light active:scale-95 transition-all flex items-center justify-center border-r border-white/10"
                                                >
                                                    -
                                                </button>
                                                <button
                                                    onClick={() => { setOccupancy(p => p + 1); triggerSync(); }}
                                                    className="bg-green-500/20 hover:bg-green-500/30 text-green-500 text-6xl font-light active:scale-95 transition-all flex items-center justify-center"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 'SCANNING' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center h-full">
                                <div className="space-y-6 order-2 lg:order-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-500/20 rounded-lg"><Smartphone className="w-5 h-5 text-blue-400" /></div>
                                        <h2 className="text-4xl font-bold">Fast ID Scanning</h2>
                                    </div>
                                    <p className="text-lg text-slate-400">
                                        Scan IDs in under a second. Automatically calculate age, verify expiration, and check your global ban list.
                                    </p>

                                    <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${autoAddEnabled ? 'bg-primary border-primary' : 'border-slate-500'}`} onClick={() => setAutoAddEnabled(!autoAddEnabled)}>
                                                {autoAddEnabled && <CheckCircle className="w-4 h-4 text-white" />}
                                            </div>
                                            <span className="text-sm font-medium text-white select-none cursor-pointer" onClick={() => setAutoAddEnabled(!autoAddEnabled)}>Auto-add +1 count on valid scan</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-6">Test the simulation by clicking an ID type below:</p>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => simulateScan('valid')}
                                                className="p-3 bg-green-900/20 border border-green-500/30 hover:bg-green-900/40 rounded-lg text-left transition-all"
                                            >
                                                <div className="font-bold text-green-400">Valid 21+</div>
                                                <div className="text-xs text-slate-400">Driver's License</div>
                                            </button>
                                            <button
                                                onClick={() => simulateScan('underage')}
                                                className="p-3 bg-red-900/20 border border-red-500/30 hover:bg-red-900/40 rounded-lg text-left transition-all"
                                            >
                                                <div className="font-bold text-red-400">Underage</div>
                                                <div className="text-xs text-slate-400">Born 2004</div>
                                            </button>
                                            <button
                                                onClick={() => simulateScan('expired')}
                                                className="p-3 bg-amber-900/20 border border-amber-500/30 hover:bg-amber-900/40 rounded-lg text-left transition-all"
                                            >
                                                <div className="font-bold text-amber-400">Expired</div>
                                                <div className="text-xs text-slate-400">Exp 2023</div>
                                            </button>
                                            <button
                                                onClick={() => simulateScan('banned')}
                                                className="p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-left transition-all"
                                            >
                                                <div className="font-bold text-slate-200">Banned Guest</div>
                                                <div className="text-xs text-slate-400">In database</div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <button onClick={handlePrev} className="text-slate-500 hover:text-white px-4 py-2 font-medium transition-colors">Back</button>
                                        <button onClick={handleNext} className="bg-white text-black font-bold px-6 py-2 rounded-full hover:scale-105 transition-transform">Next: Banning</button>
                                    </div>
                                </div>

                                <div className="relative mx-auto w-full max-w-[400px] order-1 lg:order-2">
                                    <ScannerPhoneFrame
                                        isScanning={isScanning}
                                        result={scanResult}
                                        onScanNext={() => setScanResult(null)}
                                        onBanRequest={() => { }}
                                        readonly={true}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 'BANNING' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center h-full">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-red-500/20 rounded-lg"><ShieldCheck className="w-5 h-5 text-red-400" /></div>
                                        <h2 className="text-4xl font-bold">86'ing Made Simple</h2>
                                    </div>
                                    <p className="text-lg text-slate-400">
                                        Ban problem guests instantly. The ban syncs to all your devices and venues immediately.
                                    </p>

                                    <div className="p-6 bg-slate-900 border border-white/10 rounded-2xl space-y-4">
                                        <p className="font-bold text-white">Try it out:</p>
                                        <ol className="list-decimal list-inside space-y-2 text-slate-400 text-sm">
                                            <li>Scan "Troublemaker" below</li>
                                            <li>Click the <span className="text-red-400 font-bold">BAN</span> button on the result screen</li>
                                            <li>Select a reason and confirm</li>
                                            <li>Scan them again to see the block!</li>
                                        </ol>
                                        <div className="pt-2">
                                            <button
                                                onClick={() => simulateScan('valid-to-ban')}
                                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                            >
                                                <Smartphone className="w-4 h-4" /> Scan Troublemaker
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button onClick={handlePrev} className="text-slate-500 hover:text-white px-4 py-2 font-medium transition-colors">Back</button>
                                        <button onClick={handleNext} className="bg-white text-black font-bold px-6 py-2 rounded-full hover:scale-105 transition-transform">Next: Reports</button>
                                    </div>
                                </div>

                                <div className="relative mx-auto w-full max-w-[400px]">
                                    <ScannerPhoneFrame
                                        isScanning={isScanning}
                                        result={scanResult}
                                        onScanNext={() => setScanResult(null)}
                                        onBanRequest={() => setShowBanModal(true)}
                                    />
                                    {/* Mock Ban Modal Overlay */}
                                    <AnimatePresence>
                                        {showBanModal && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 100 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 100 }}
                                                className="absolute inset-x-4 bottom-4 top-20 bg-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col z-20 border border-slate-700"
                                            >
                                                <div className="font-bold text-xl mb-4">Ban Patron</div>
                                                <div className="space-y-4 flex-1">
                                                    <div>
                                                        <label className="text-xs text-slate-500 uppercase font-bold">Duration</label>
                                                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 mt-1 text-sm">
                                                            <option>Permanent</option>
                                                            <option>30 Days</option>
                                                            <option>24 Hours</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-500 uppercase font-bold">Reason</label>
                                                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 mt-1 text-sm">
                                                            <option>Choose reason...</option>
                                                            <option>Aggressive Behavior</option>
                                                            <option>Fake ID</option>
                                                            <option>Theft</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mt-4">
                                                    <button onClick={() => setShowBanModal(false)} className="py-2 rounded-lg bg-slate-700 font-bold text-sm">Cancel</button>
                                                    <button onClick={confirmBan} className="py-2 rounded-lg bg-red-500 text-white font-bold text-sm">Confirm Ban</button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {step === 'REPORTING' && (
                            <div className="flex flex-col h-full space-y-8">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                    <div className="space-y-2">
                                        <h2 className="text-4xl font-bold">Actionable Insights</h2>
                                        <p className="text-slate-400">
                                            Automated reports sent to your email daily. Export via CSV or PDF for compliance.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                                        {['24H', '7D', '30D'].map(r => (
                                            <button
                                                key={r}
                                                onClick={() => setDateRange(r as any)}
                                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dateRange === r ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col">
                                    {/* Chart Header */}
                                    <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                                        <div>
                                            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Total Foot Traffic</div>
                                            <div className="text-3xl font-bold flex items-baseline gap-3">
                                                {dateRange === '24H' ? '2,408' : dateRange === '7D' ? '14,205' : '58,930'}
                                                <span className="text-sm font-medium text-green-400">
                                                    {dateRange === '24H' ? '+12%' : dateRange === '7D' ? '+5%' : '+8%'} vs prev
                                                </span>
                                            </div>
                                        </div>

                                        {/* Legend Toggles */}
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => toggleSeries('current')}
                                                className={`flex items-center gap-2 text-sm font-medium transition-opacity ${visibleSeries.current ? 'opacity-100' : 'opacity-40 line-through'}`}
                                            >
                                                <div className="w-3 h-3 rounded-full bg-indigo-500" /> Current
                                            </button>
                                            <button
                                                onClick={() => toggleSeries('previous')}
                                                className={`flex items-center gap-2 text-sm font-medium transition-opacity ${visibleSeries.previous ? 'opacity-100' : 'opacity-40 line-through'}`}
                                            >
                                                <div className="w-3 h-3 rounded-full bg-slate-500 border border-white/20" /> Previous
                                            </button>
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm font-bold border border-slate-700 hover:bg-slate-700 transition-colors">
                                                <FileSpreadsheet className="w-4 h-4 text-green-400" /> CSV
                                            </button>
                                            <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm font-bold border border-slate-700 hover:bg-slate-700 transition-colors">
                                                <FileText className="w-4 h-4 text-red-400" /> PDF
                                            </button>
                                        </div>
                                    </div>

                                    {/* Chart */}
                                    <div className="flex-1 w-full min-h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={getChartData(dateRange)}>
                                                <defs>
                                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis
                                                    dataKey="time"
                                                    stroke="#ffffff40"
                                                    tick={{ fill: '#ffffff40', fontSize: 12 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <YAxis
                                                    stroke="#ffffff40"
                                                    tick={{ fill: '#ffffff40', fontSize: 12 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: any) => [value?.toLocaleString(), 'Visitors']}
                                                    labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                                                />
                                                {visibleSeries.current && (
                                                    <Area
                                                        type="monotone"
                                                        dataKey="value"
                                                        stroke="#6366f1"
                                                        strokeWidth={3}
                                                        fillOpacity={1}
                                                        fill="url(#colorValue)"
                                                        name="Current Period"
                                                        animationDuration={1000}
                                                    />
                                                )}
                                                {visibleSeries.previous && (
                                                    <Area
                                                        type="monotone"
                                                        dataKey="prev"
                                                        stroke="#ffffff30"
                                                        strokeWidth={2}
                                                        strokeDasharray="5 5"
                                                        fill="transparent"
                                                        name="Previous Period"
                                                        animationDuration={1000}
                                                    />
                                                )}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4">
                                    <button onClick={handlePrev} className="text-slate-500 hover:text-white px-4 py-2 font-medium transition-colors">Back</button>
                                    <button onClick={handleNext} className="bg-white text-black font-bold px-8 py-3 rounded-full hover:scale-105 transition-transform flex items-center gap-2">
                                        Finish Tour <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'CTA' && (
                            <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center max-w-3xl mx-auto">
                                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-10 h-10 text-black" />
                                </div>
                                <h1 className="text-4xl md:text-6xl font-bold">You're ready to launch.</h1>
                                <p className="text-xl text-slate-400">
                                    CLICR replaces 5 different tools with one seamless operating system.
                                    Start your 14-day free pilot today found at clicr.co
                                </p>

                                <div className="grid md:grid-cols-2 gap-4 w-full max-w-lg pt-8">
                                    <Link href="/signup" className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all transform hover:scale-[1.02] flex items-center justify-center">
                                        Start Free Pilot
                                    </Link>
                                    <a href="mailto:sales@clicr.co" className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold text-lg border border-slate-700 transition-all flex items-center justify-center">
                                        Book Live Demo
                                    </a>
                                </div>

                                <button onClick={handleRestart} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mt-8">
                                    <RotateCcw className="w-4 h-4" /> Restart Tour
                                </button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );

    // --- Helpers & Logic ---

    function simulateScan(type: string) {
        setIsScanning(true);
        setScanResult(null);
        setTimeout(() => {
            setIsScanning(false);
            if (type === 'valid') {
                setScanResult({ type: 'VALID', data: MOCK_IDS.valid });
                if (autoAddEnabled) {
                    setOccupancy(p => p + 1);
                    triggerSync();
                }
            } else if (type === 'underage') {
                setScanResult({ type: 'DENIED', reason: 'UNDERAGE', data: MOCK_IDS.underage });
            } else if (type === 'expired') {
                setScanResult({ type: 'DENIED', reason: 'ID EXPIRED', data: MOCK_IDS.expired });
            } else if (type === 'banned') {
                setScanResult({ type: 'DENIED', reason: 'BANNED: REPEAT OFFENDER', data: MOCK_IDS.banned });
            } else if (type === 'valid-to-ban') {
                // If we already banned this "temp" person locally
                if (bannedList.includes('Sarah Troublemaker')) {
                    setScanResult({ type: 'DENIED', reason: 'BANNED: Aggressive Behavior', data: { ...MOCK_IDS.valid, name: 'Sarah Troublemaker' } });
                } else {
                    setScanResult({ type: 'VALID', data: { ...MOCK_IDS.valid, name: 'Sarah Troublemaker' } });
                }
            }
        }, 1200); // 1.2s scan time
    }

    function confirmBan() {
        setShowBanModal(false);
        setBannedList(prev => [...prev, 'Sarah Troublemaker']);
        // Re-simulate scan result immediately to show update
        setScanResult(null); // clear first
        setTimeout(() => {
            setScanResult({ type: 'DENIED', reason: 'BANNED: Aggressive Behavior', data: { ...MOCK_IDS.valid, name: 'Sarah Troublemaker' } });
        }, 500);
    }
}

// --- Sub Components ---

function ScannerPhoneFrame({ isScanning, result, onScanNext, onBanRequest, readonly }: any) {
    return (
        <div className="bg-black border-[12px] border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden aspect-[9/19] relative flex flex-col">
            {/* Status Bar */}
            <div className="h-10 bg-black flex justify-between items-center px-6 pt-2">
                <div className="text-[10px] text-white font-bold">9:41</div>
                <div className="flex gap-1">
                    <div className="w-3 h-3 bg-white rounded-full opacity-20" />
                    <div className="w-3 h-3 bg-white rounded-full" />
                </div>
            </div>

            <div className="flex-1 bg-black relative flex flex-col">
                {/* Camera Viewfinder Sim */}
                {!result && (
                    <div className="absolute inset-0 bg-slate-900">
                        {isScanning ? (
                            <>
                                <div className="absolute inset-0 bg-green-900/10 animate-pulse" />
                                <div className="absolute top-1/4 left-8 right-8 h-48 border-2 border-green-400 rounded-xl flex items-center justify-center">
                                    <div className="w-full h-0.5 bg-green-500 blur-sm animate-scan-line" />
                                </div>
                                <div className="absolute bottom-12 w-full text-center text-green-400 font-mono animate-pulse">Scanning...</div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                                <div className="w-48 h-32 border-2 border-dashed border-slate-700 rounded-xl" />
                                <p className="text-xs uppercase tracking-widest">Ready to Scan</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Result Overlay */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            className={`absolute inset-0 z-10 flex flex-col ${result.type === 'VALID' ? 'bg-green-600' : 'bg-red-600'}`}
                        >
                            <div className="flex-1 flex col items-center justify-center text-center p-6 text-white space-y-4">
                                {result.type === 'VALID' ? (
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-green-600 mb-4 shadow-xl">
                                        <CheckCircle className="w-12 h-12" />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-red-600 mb-4 shadow-xl">
                                        <XCircle className="w-12 h-12" />
                                    </div>
                                )}

                                <div>
                                    <h2 className="text-4xl font-black uppercase tracking-tight">{result.type === 'VALID' ? 'ALLOWED' : 'DENIED'}</h2>
                                    {result.reason && <p className="text-white/80 font-bold mt-1 text-lg">{result.reason}</p>}
                                </div>
                            </div>

                            <div className="bg-white text-slate-900 p-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                                <div className="space-y-4 mb-6">
                                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-bold">Name</div>
                                            <div className="text-xl font-bold pt-1">{result.data.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-400 uppercase font-bold">Age</div>
                                            <div className="text-xl font-bold pt-1">{result.data.age}</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-bold">DOB</div>
                                            <div className="font-mono pt-1">{result.data.dob}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-bold">Exp</div>
                                            <div className={`font-mono pt-1 font-bold ${result.reason?.includes('EXPIRED') ? 'text-red-500' : 'text-slate-900'}`}>{result.data.exp}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {!readonly && result.type === 'VALID' && (
                                        <button onClick={onBanRequest} className="py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors">
                                            86 / Ban
                                        </button>
                                    )}
                                    <button onClick={onScanNext} className={`py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors ${readonly || result.type !== 'VALID' ? 'col-span-2' : ''}`}>
                                        Scan Next
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// --- Data Helpers ---

function getChartData(range: '24H' | '7D' | '30D') {
    const data = [];

    if (range === '24H') {
        for (let i = 20; i < 24; i++) { // 8 PM to 4 AM
            const hour = i > 23 ? i - 24 : i;
            const label = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour} ${i >= 12 && i < 24 ? 'PM' : 'AM'}`;
            const base = Math.sin((i - 20) * 0.5) * 400 + 100;
            data.push({ time: label, value: Math.floor(Math.max(0, base + Math.random() * 50)), prev: Math.floor(Math.max(0, base * 0.9)) });
        }
        for (let i = 0; i < 4; i++) {
            const label = `${i === 0 ? 12 : i} AM`;
            const base = Math.max(0, 500 - (i * 150));
            data.push({ time: label, value: Math.floor(Math.max(0, base + Math.random() * 30)), prev: Math.floor(Math.max(0, base * 0.8)) });
        }
    } else if (range === '7D') {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(d => {
            const isWeekend = d === 'Fri' || d === 'Sat';
            const val = isWeekend ? 2500 : 800;
            data.push({
                time: d,
                value: val + Math.floor(Math.random() * 200),
                prev: (val * 0.9) + Math.floor(Math.random() * 200)
            });
        });
    } else { // 30D
        for (let i = 1; i <= 30; i++) {
            const isWeekend = i % 7 === 5 || i % 7 === 6; // Rough approx
            const val = isWeekend ? 2500 : 800;
            data.push({
                time: `Day ${i}`,
                value: val + Math.floor(Math.random() * 500),
                prev: (val * 0.95) + Math.floor(Math.random() * 500)
            })
        }
    }

    return data;
}


