'use client';

import { completeOnboarding } from './actions'
import { Rocket, Building2, MapPin } from 'lucide-react'

export default function OnboardingPage() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-30 -z-10" />

            <div className="w-full max-w-lg bg-slate-900/50 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-xl">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary border border-primary/20">
                        <Rocket className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-3">Setup Your Organization</h1>
                    <p className="text-slate-400">Welcome to CLICR. Let's get your first workspace ready in seconds.</p>
                </div>

                <form action={completeOnboarding} className="space-y-6">

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Business Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                <input
                                    name="businessName"
                                    type="text"
                                    required
                                    placeholder="e.g. Nightlife Group LLC"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">First Venue Name</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                <input
                                    name="venueName"
                                    type="text"
                                    required
                                    placeholder="e.g. The Grand Club"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all transform hover:scale-[1.02]">
                        Launch Dashboard
                    </button>
                </form>
            </div>
        </div>
    )
}
