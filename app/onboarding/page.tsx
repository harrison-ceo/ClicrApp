
import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { StepContainer, BusinessStep, VenueStep, AreaStep, ClicrStep } from './client-steps';
import { AlertTriangle, Terminal } from 'lucide-react';
import Link from 'next/link';

async function OnboardingWizardContent({ searchParams }: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // If not logged in, Start -> Signup
    if (!user) return redirect('/onboarding/signup');

    // Fetch progress with explicit error handling
    const { data: progress, error: fetchError } = await supabase.from('onboarding_progress').select('user_id, business_id, current_step').eq('user_id', user.id).single();

    // Check for critical DB error (missing table)
    if (fetchError && fetchError.code === '42P01') {
        console.error("Critical: onboarding_progress table missing");
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h1 className="text-xl font-bold mb-2">System Error: Database Update Required</h1>
                <p className="text-slate-400 mb-4">The onboarding system is missing a required database table.</p>
                <code className="bg-slate-900 p-4 rounded text-xs text-left block mb-4">
                    Error: relation "public.onboarding_progress" does not exist. <br />
                    Migration 16_onboarding_robust.sql has not been applied.
                </code>
            </div>
        )
    }

    // Auto-initialize if missing (and no error)
    if (!progress && !fetchError) {
        // If they have no progress, treat as new onboarding
        const { error: insertError } = await supabase.from('onboarding_progress').upsert({
            user_id: user.id,
            current_step: 2
        }, { onConflict: 'user_id' });

        if (insertError) {
            console.error("Insert progress failed:", insertError);
            return (
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                    <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
                    <p>Failed to initialize onboarding.</p>
                    <pre className="text-xs text-slate-500 mt-2">{insertError.message}</pre>
                </div>
            );
        }

        // Refresh to load the new row
        return redirect('/onboarding');
    }

    // If completed, strict guardrail to dashboard
    if ((progress?.current_step || 0) > 500) return redirect('/dashboard');

    const params = await searchParams;
    const error = params.error;

    // Logic to resolve data for steps
    const step = Number(progress?.current_step || 2);
    // PAYLOAD IS BROKEN - IGNORE IT

    // Derived State from URL & DB
    const idxParam = params.idx;
    const activeVenueIndex = idxParam ? parseInt(idxParam as string) : 0;

    let currentVenue = null;
    let venues: any[] = [];
    let venueCount = 1;
    let areas: any[] = [];

    // Fetch Business Context
    const businessId = progress?.business_id;

    if (businessId) {
        // Fetch Venues
        const { data: v, error: vErr } = await supabase.from('venues').select('*').eq('business_id', businessId).order('created_at');
        if (v) {
            venues = v;
            venueCount = v.length || 1;
            if (venues.length > activeVenueIndex) {
                currentVenue = venues[activeVenueIndex];
            }
        }
    }

    // If Step 5, fetch areas for current venue to populate Clicr setup
    if (step === 5 && currentVenue) {
        // Sort by creation to be consistent
        const { data: a } = await supabase.from('areas').select('*').eq('venue_id', currentVenue.id).order('created_at');
        areas = a || [];
    }

    /* DEBUG PANEL DATA */
    const debugInfo = {
        userId: user.id,
        step,
        businessId,
        venueCount,
        activeVenueIndex,
        currentVenueId: currentVenue?.id,
        venuesLoaded: venues.length
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[100px] -z-10" />

            <Link href="/api/auth/signout" className="absolute top-8 left-8 text-slate-600 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
                Cancel Setup
            </Link>

            {error && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg flex items-center gap-2 text-sm z-50 animate-in fade-in slide-in-from-top-2 shadow-xl">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}. <Link href="/onboarding" className="underline font-bold">Retry</Link></span>
                </div>
            )}

            {step === 2 && (
                <StepContainer title="Tell us about yourself" subtitle="We'll structure your account based on your setup." stepNumber={1} totalSteps={4}>
                    <BusinessStep />
                </StepContainer>
            )}

            {step === 3 && (
                <StepContainer title="Add your Venues" subtitle={`Let's set up venue ${activeVenueIndex + 1} of ${venueCount}.`} stepNumber={2} totalSteps={4}>
                    <VenueStep index={activeVenueIndex} total={venueCount} />
                </StepContainer>
            )}

            {step === 4 && (
                <StepContainer title="Define Areas" subtitle={currentVenue ? `Where do guests enter/exit ${currentVenue.name}?` : 'Set up areas within your venue.'} stepNumber={3} totalSteps={4}>
                    <AreaStep venueName={currentVenue?.name || 'Venue'} index={activeVenueIndex} />
                </StepContainer>
            )}

            {step === 5 && (
                <StepContainer title="Connect Clicrs" subtitle={currentVenue ? `Assign devices to areas in ${currentVenue.name}.` : 'Set up your devices.'} stepNumber={4} totalSteps={4}>
                    <ClicrStep venueName={currentVenue?.name || 'Venue'} areas={areas} index={activeVenueIndex} />
                </StepContainer>
            )}

            {/* Hidden Debug Panel */}
            <div className="fixed bottom-2 right-2 opacity-0 hover:opacity-100 transition-opacity p-2 bg-black/90 border border-white/10 rounded text-[10px] text-green-500 font-mono z-[9999]">
                <div className="flex items-center gap-2 mb-1 border-b border-white/10 pb-1">
                    <Terminal className="w-3 h-3" /> System Trace
                </div>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
        </div>
    )
}

export default function OnboardingWizard(props: any) {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-sm">Resuming setup...</p>
            </div>
        }>
            <OnboardingWizardContent {...props} />
        </Suspense>
    )
}
