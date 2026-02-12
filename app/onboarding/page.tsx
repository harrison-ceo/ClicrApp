'use client'

import { completeOnboarding, joinWithInvite } from './actions'
import { Rocket, Building2, MapPin, AlertTriangle, UserPlus, KeyRound, Crown, Users } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { cn } from '@/lib/utils'

type OnboardingRole = 'org_owner' | 'venue_owner' | 'venue_staff'

function OnboardingForm() {
    const searchParams = useSearchParams()
    const error = searchParams.get('error')
    const codeFromUrl = searchParams.get('code') ?? ''
    const [role, setRole] = useState<OnboardingRole | null>(codeFromUrl ? 'venue_staff' : null)
    const [inviteCode, setInviteCode] = useState(codeFromUrl)

    const isCreator = role === 'org_owner'
    const isJoiner = role === 'venue_owner' || role === 'venue_staff'

    return (
        <div className="w-full max-w-lg bg-slate-900/50 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary border border-primary/20">
                    <Rocket className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">Welcome to CLICR</h1>
                <p className="text-slate-400">Choose how you&apos;re joining, then set up or join a workspace.</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Role selector */}
            <div className="mb-8">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    I am a…
                </label>
                <div className="grid grid-cols-1 gap-2">
                    {[
                        { value: 'org_owner' as const, label: 'Org owner', desc: 'Create a new organization and venues', icon: Crown },
                        { value: 'venue_owner' as const, label: 'Venue owner', desc: 'I have a venue and want to join an existing org', icon: Building2 },
                        { value: 'venue_staff' as const, label: 'Venue staff', desc: 'I was invited to a venue', icon: Users },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRole(opt.value)}
                            className={cn(
                                'flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                                role === opt.value
                                    ? 'border-primary bg-primary/10 text-white'
                                    : 'border-white/10 bg-black/40 text-slate-300 hover:border-white/20'
                            )}
                        >
                            <opt.icon className={cn('w-5 h-5 shrink-0', role === opt.value ? 'text-primary' : 'text-slate-500')} />
                            <div>
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Create org + first venue (org owner only) — matches venues/new flow */}
            {isCreator && (
                <form action={completeOnboarding} className="space-y-6">
                    <input type="hidden" name="role" value="org_owner" />
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Organization name (Inc, LLC)</label>
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
                            <p className="text-xs text-slate-500 mt-1">This will appear on your reports and dashboard.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Venue name</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                                <input
                                    name="venueName"
                                    type="text"
                                    required
                                    placeholder="e.g. Downtown Club"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">City</label>
                                <input
                                    name="venueCity"
                                    type="text"
                                    required
                                    placeholder="City"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">State</label>
                                <input
                                    name="venueState"
                                    type="text"
                                    required
                                    placeholder="State"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total capacity limit</label>
                            <input
                                name="venueCapacity"
                                type="number"
                                required
                                defaultValue={500}
                                min={1}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all">
                        Create organization & venue
                    </button>
                </form>
            )}

            {/* Join with invite code (venue owner / venue staff) */}
            {isJoiner && (
                <form action={joinWithInvite} className="space-y-6">
                    <input type="hidden" name="role" value={role!} />
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Invite code or link
                        </label>
                        <p className="text-slate-500 text-sm mb-2">
                            Ask your org or venue owner for an invite code, or paste the full invite link.
                        </p>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                            <input
                                name="inviteCode"
                                type="text"
                                required
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder="e.g. abc123 or https://app.clicr.com/join?code=..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
                    >
                        <UserPlus className="w-5 h-5" />
                        Join workspace
                    </button>
                </form>
            )}

            {!role && (
                <p className="text-slate-500 text-sm text-center">Select an option above to continue.</p>
            )}
        </div>
    )
}

export default function OnboardingPage() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-30 -z-10" />
            <Suspense fallback={<div className="text-white">Loading…</div>}>
                <OnboardingForm />
            </Suspense>
        </div>
    )
}
