"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, MapPin, Layers, Users, ShieldCheck, Smartphone, Play, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';

// --- TYPES ---
type OnboardingStep =
    | 'PROFILE'
    | 'VENUE'
    | 'AREAS'
    | 'CAPACITY'
    | 'TEAM'
    | 'DEVICES'
    | 'TEST_RUN'
    | 'COMPLETE';

const STEPS: { id: OnboardingStep; label: string; icon: any }[] = [
    { id: 'PROFILE', label: 'Business', icon: Building2 },
    { id: 'VENUE', label: 'Venue', icon: MapPin },
    { id: 'AREAS', label: 'Areas', icon: Layers },
    { id: 'CAPACITY', label: 'Rules', icon: ShieldCheck },
    { id: 'TEAM', label: 'Team', icon: Users },
    { id: 'DEVICES', label: 'Devices', icon: Smartphone },
    { id: 'TEST_RUN', label: 'Test', icon: Play },
];

export default function OnboardingWizard() {
    const router = useRouter();
    const { venues, areas, addVenue, addArea } = useApp();

    // State
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('PROFILE');
    const [direction, setDirection] = useState(1);

    // Form Data (simplified for demo)
    const [businessName, setBusinessName] = useState('');
    const [venueName, setVenueName] = useState('');
    const [venueCity, setVenueCity] = useState('');
    const [selectedAreas, setSelectedAreas] = useState<string[]>(['Main Room']);
    const [capacityRule, setCapacityRule] = useState<'WARN' | 'HARD'>('WARN');

    // Navigation Helpers
    const goToNext = () => {
        const idx = STEPS.findIndex(s => s.id === currentStep);
        if (idx < STEPS.length - 1) {
            setDirection(1);
            setCurrentStep(STEPS[idx + 1].id);
        } else {
            // Complete
            setCurrentStep('COMPLETE');
        }
    };

    const goToBack = () => {
        const idx = STEPS.findIndex(s => s.id === currentStep);
        if (idx > 0) {
            setDirection(-1);
            setCurrentStep(STEPS[idx - 1].id);
        }
    };

    // Render Steps
    const renderStepContent = () => {
        switch (currentStep) {
            case 'PROFILE':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white">Create Business Profile</h2>
                            <p className="text-slate-400">Let's set up your organization.</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Business Name</label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Acme Nightlife Group"
                                    className="w-full bg-slate-800 border-none rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-primary mt-2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timezone</label>
                                    <select className="w-full bg-slate-800 border-none rounded-xl p-4 text-white mt-2">
                                        <option>EST (New York)</option>
                                        <option>PST (Los Angeles)</option>
                                        <option>CST (Chicago)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cutoff Time</label>
                                    <select className="w-full bg-slate-800 border-none rounded-xl p-4 text-white mt-2">
                                        <option>6:00 AM</option>
                                        <option>4:00 AM</option>
                                        <option>5:00 AM</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'VENUE':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white">Add Your First Venue</h2>
                            <p className="text-slate-400">Where will you be counting?</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Venue Name</label>
                                <input
                                    type="text"
                                    value={venueName}
                                    onChange={(e) => setVenueName(e.target.value)}
                                    placeholder="The Grand Hall"
                                    className="w-full bg-slate-800 border-none rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-primary mt-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">City & State</label>
                                <input
                                    type="text"
                                    value={venueCity}
                                    onChange={(e) => setVenueCity(e.target.value)}
                                    placeholder="New York, NY"
                                    className="w-full bg-slate-800 border-none rounded-xl p-4 text-white placeholder:text-slate-600 mt-2"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'AREAS':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white">Define Areas</h2>
                            <p className="text-slate-400">Select zones to track separately.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {['Main Room', 'Patio', 'VIP', 'Rooftop', 'Bar', 'Entrance'].map(area => (
                                <button
                                    key={area}
                                    onClick={() => {
                                        if (selectedAreas.includes(area)) setSelectedAreas(selectedAreas.filter(a => a !== area));
                                        else setSelectedAreas([...selectedAreas, area]);
                                    }}
                                    className={cn(
                                        "p-4 rounded-xl border flex items-center justify-center transition-all font-bold",
                                        selectedAreas.includes(area)
                                            ? "bg-primary text-black border-primary"
                                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                                    )}
                                >
                                    {area}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-center text-slate-500">You can rename these later.</p>
                    </div>
                );

            case 'CAPACITY':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white">Capacity Rules</h2>
                            <p className="text-slate-400">What happens when you hit 100%?</p>
                        </div>
                        <div className="space-y-4">
                            <button
                                onClick={() => setCapacityRule('WARN')}
                                className={cn("w-full p-4 rounded-xl border flex flex-col items-start gap-1 transition-all", capacityRule === 'WARN' ? "bg-amber-500/10 border-amber-500" : "bg-slate-800 border-slate-700")}
                            >
                                <div className={cn("font-bold", capacityRule === 'WARN' ? "text-amber-500" : "text-white")}>Warn Only (Recommended)</div>
                                <div className="text-sm text-slate-400">Staff get an alert but can continue admitting guests.</div>
                            </button>

                            <button
                                onClick={() => setCapacityRule('HARD')}
                                className={cn("w-full p-4 rounded-xl border flex flex-col items-start gap-1 transition-all", capacityRule === 'HARD' ? "bg-red-500/10 border-red-500" : "bg-slate-800 border-slate-700")}
                            >
                                <div className={cn("font-bold", capacityRule === 'HARD' ? "text-red-500" : "text-white")}>Hard Stop</div>
                                <div className="text-sm text-slate-400">Scanning blocked. Manager PIN required to override.</div>
                            </button>
                        </div>
                    </div>
                );

            case 'COMPLETE':
                return (
                    <div className="space-y-8 text-center py-8">
                        <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">You're Ready to Go!</h2>
                            <p className="text-slate-400 max-w-xs mx-auto">Your venue is set up. Next, pair your devices to start counting.</p>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-primary/25"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                );

            default:
                return <div className="text-slate-500 text-center">Step content coming soon...</div>;
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2 text-primary font-bold tracking-wider">
                    <ShieldCheck className="w-6 h-6" /> CLICR
                </div>
                <button onClick={() => router.push('/dashboard')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
                    Skip Setup
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#0f1218] to-black">
                <div className="w-full max-w-md">
                    {/* Progress Bar */}
                    {currentStep !== 'COMPLETE' && (
                        <div className="mb-8">
                            <div className="flex justify-between mb-2 px-1">
                                {STEPS.map((step, idx) => {
                                    const activeIdx = STEPS.findIndex(s => s.id === currentStep);
                                    const isComplete = idx < activeIdx;
                                    const isActive = idx === activeIdx;
                                    const Icon = step.icon;

                                    return (
                                        <div key={step.id} className="flex flex-col items-center gap-1">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                                isComplete ? "bg-primary text-black" : isActive ? "bg-white text-black" : "bg-slate-800 text-slate-500"
                                            )}>
                                                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                            </div>
                                            <span className={cn("text-[10px] font-bold uppercase hidden md:block", isActive ? "text-white" : "text-slate-600")}>
                                                {step.label}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full mt-2 relative overflow-hidden">
                                <motion.div
                                    className="absolute top-0 left-0 h-full bg-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(STEPS.findIndex(s => s.id === currentStep) / (STEPS.length - 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step Card */}
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            initial={{ x: direction * 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: direction * -20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[#1e2330]/50 border border-white/5 p-8 rounded-3xl shadow-2xl backdrop-blur-sm"
                        >
                            {renderStepContent()}
                        </motion.div>
                    </AnimatePresence>

                    {/* Footer Controls */}
                    {currentStep !== 'COMPLETE' && (
                        <div className="flex justify-between mt-8">
                            <button
                                onClick={goToBack}
                                disabled={currentStep === 'PROFILE'}
                                className="px-6 py-3 rounded-xl text-slate-400 font-bold hover:text-white disabled:opacity-0 transition-all flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                                onClick={goToNext}
                                className="px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-lg flex items-center gap-2"
                            >
                                {STEPS.findIndex(s => s.id === currentStep) === STEPS.length - 1 ? 'Finish' : 'Next'} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
