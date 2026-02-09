
'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

async function logError(userId: string | undefined, context: string, error: any) {
    console.error(`[${context}] Error:`, error);
    try {
        const supabase = await createClient();
        if (userId) {
            await supabase.from('app_errors').insert({
                user_id: userId,
                context,
                error_message: error.message || JSON.stringify(error),
                stack: error.stack
            });
        }
    } catch (e) {
        // Fallback
        console.error('Failed to log error to DB', e);
    }
}

export async function signup(formData: FormData) {
    const supabase = await createClient();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
        return redirect('/onboarding/signup?error=Passwords do not match');
    }

    // attempt signup
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                role: 'owner' // default role metadata
            }
        }
    });

    if (error) {
        console.error('Signup error:', error);
        return redirect(`/onboarding/signup?error=${encodeURIComponent(error.message)}`);
    }

    // Case 1: Session exists (Auto-confirm disabled or immediate login)
    if (data.session) {
        const user = data.user!;

        // Initialize progress
        const { error: progressError } = await supabase.from('onboarding_progress').upsert({
            user_id: user.id,
            current_step: 2,
            completed: false
        }, { onConflict: 'user_id' });

        if (progressError) {
            await logError(user.id, 'signup_progress_init', progressError);
        }

        return redirect('/onboarding');
    }

    // Case 2: No session (Email confirmation required)
    if (data.user && !data.session) {
        return redirect('/onboarding/verify-email');
    }

    return redirect('/onboarding/signup?error=Something went wrong');
}

export async function submitStep(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect('/auth/signin');
    }

    // Get current progress with SAFE column selection (avoiding 'payload' and 'completed' errors)
    const { data: progress, error: progressFetchError } = await supabase
        .from('onboarding_progress')
        .select('user_id, business_id, current_step')
        .eq('user_id', user.id)
        .single();

    if (progressFetchError || !progress) {
        // Recovery
        await logError(user.id, 'debug_progress_fetch_fail', { error: progressFetchError });
        await supabase.from('onboarding_progress').upsert({ user_id: user.id, current_step: 2 });
        return redirect('/onboarding');
    }

    const step = progress.current_step;
    // const payload = progress.payload || {}; // PAYLOAD COLUMN IS MISSING/BROKEN
    const payload: any = {}; // Dummy payload to satisfy type checker if needed, but we won't use it for persistence


    try {
        /* ============================================================
           STEP 2: BUSINESS SETUP
           ============================================================ */
        if (step === 2) {
            const businessName = formData.get('businessName') as string;
            const venueCount = parseInt(formData.get('venueCount') as string);

            if (!businessName || !venueCount) throw new Error('Missing fields');

            let businessId = progress.business_id;

            // Upsert Business
            if (businessId) {
                // Update existing
                const { error: busError } = await supabase
                    .from('businesses')
                    .update({ name: businessName })
                    .eq('id', businessId);
                if (busError) throw busError;
            } else {
                // Insert new
                const { data: business, error: busError } = await supabase
                    .from('businesses')
                    .insert({ name: businessName, created_by_user_id: user.id })
                    .select()
                    .single();

                if (busError) throw busError;
                businessId = business.id;
                await logError(user.id, 'debug_biz_created', { businessId });
            }

            // Ensure Membership
            const { error: memError } = await supabase
                .from('business_members')
                .upsert({
                    business_id: businessId,
                    user_id: user.id,
                    role: 'owner'
                }, { onConflict: 'business_id,user_id' });

            if (memError) throw memError;
            await logError(user.id, 'debug_mem_upserted', { businessId });

            /*
            // PRE-SEED VENUES (Since we can't store venueCount in payload)
            // Check if we already have venues
            const { count } = await supabase.from('venues').select('*', { count: 'exact', head: true }).eq('business_id', businessId);
            
            if ((count || 0) < venueCount) {
                 const needed = venueCount - (count || 0);
                 const venuesToInsert = Array.from({ length: needed }).map((_, i) => ({
                     business_id: businessId,
                     name: `Venue ${(count || 0) + i + 1}`,
                     capacity_max: 100 // Default
                 }));
                 const { error: seedError } = await supabase.from('venues').insert(venuesToInsert);
                 if (seedError) throw seedError;
            }
            */

            // Move to Step 3
            // We DO NOT write payload. We rely on the venues table.
            await supabase.from('onboarding_progress').update({
                business_id: businessId,
                current_step: 3,
            }).eq('user_id', user.id);

            /* ============================================================
               STEP 3: VENUE SETUP (LOOP)
               ============================================================ */
        } else if (step === 3) {
            const venueName = formData.get('venueName') as string;
            const capacity = parseInt(formData.get('capacity') as string);
            const location = formData.get('location') as string;
            const activeIndex = parseInt(formData.get('activeVenueIndex') as string || '0');

            if (!progress.business_id) throw new Error('No business context');

            // Fetch Venues for this business (sorted)
            const { data: venues, error: vFail } = await supabase.from('venues').select('*').eq('business_id', progress.business_id).order('created_at');
            if (vFail || !venues || venues.length === 0) throw new Error("No venues found for Step 3");

            const venueCount = venues.length;

            if (activeIndex >= venueCount) {
                // Should not happen, but auto-recover
                await supabase.from('onboarding_progress').update({ current_step: 4 }).eq('user_id', user.id);
                return redirect('/onboarding');
            }

            const currentVenueId = venues[activeIndex]?.id;

            if (currentVenueId) {
                // Update existing venue
                await supabase.from('venues').update({
                    name: venueName,
                    capacity_max: capacity,
                    location_text: location
                }).eq('id', currentVenueId);
            }

            const nextIndex = activeIndex + 1;

            if (nextIndex < venueCount) {
                // Redirect to next venue
                return redirect(`/onboarding?idx=${nextIndex}`);
            } else {
                // Done with venues -> Go to Areas
                await supabase.from('onboarding_progress').update({ current_step: 4 }).eq('user_id', user.id);
                return redirect('/onboarding');
            }

            /* ============================================================
               STEP 4: AREAS SETUP (LOOP via Venues)
               ============================================================ */
        } else if (step === 4) {
            // Get index from Search Params via "hidden input" or just infer from DB state?
            // "client-steps" doesn't submit index for Step 4... 
            // We should auto-detect or modify client-steps?
            // Or just check which venue needs areas?
            // Safer: Modify client-steps to pass index. 
            // BUT simpler: Iterate venues, find first without areas? No, areas might be 0.
            // Let's assume we pass it? 
            // Actually, for Step 4/5, we can just process ALL needed setups on one big page? No, UI is per venue.

            // NOTE: Since I can't edit client-steps instantly for Step 4/5 easily without risks,
            // I will use a clever hack:
            // Read "referer" or just implement a "next" pointer query.

            // Let's assume I modified client-steps already? Not yet.
            // I will modify client-steps for Step 4/5 too.
            // OR I can read it from the "areas" JSON if I embedded the venue ID? No.

            // Let's rely on a URL param ?idx being present in the Referer, and if not, default to 0.
            // But Action doesn't see Referer easily.
            // I will Add <input name="activeVenueIndex"> to AreaStep and ClicrStep too.

            const activeIndex = parseInt(formData.get('activeVenueIndex') as string || '0');
            const areasRaw = formData.get('areas');
            const areas = JSON.parse(areasRaw as string || '[]');

            const { data: venues } = await supabase.from('venues').select('id').eq('business_id', progress.business_id).order('created_at');
            if (!venues) throw new Error("No venues");

            const currentVenueId = venues[activeIndex]?.id;

            // Delete existing areas for this venue
            await supabase.from('areas').delete().eq('venue_id', currentVenueId);

            for (const area of areas) {
                const { data: areaRow, error: areaError } = await supabase
                    .from('areas')
                    .insert({
                        business_id: progress.business_id,
                        venue_id: currentVenueId,
                        name: area.name,
                        capacity_max: area.capacity || null
                    })
                    .select()
                    .single();

                if (areaError) throw areaError;

                // Create Snapshot
                await supabase.from('occupancy_snapshots').insert({
                    business_id: progress.business_id,
                    venue_id: currentVenueId,
                    area_id: areaRow.id,
                    current_occupancy: 0
                });
            }

            const nextIndex = activeIndex + 1;
            if (nextIndex < venues.length) {
                return redirect(`/onboarding?idx=${nextIndex}`);
            } else {
                // Done with Areas -> Go to Clicrs
                await supabase.from('onboarding_progress').update({ current_step: 5 }).eq('user_id', user.id);
                return redirect('/onboarding');
            }

            /* ============================================================
               STEP 5: CLICRS SETUP (LOOP via Venues)
               ============================================================ */
        } else if (step === 5) {
            const activeIndex = parseInt(formData.get('activeVenueIndex') as string || '0');
            const devicesRaw = formData.get('devices');
            const devicesMap = JSON.parse(devicesRaw as string || '{}');

            const { data: venues } = await supabase.from('venues').select('id').eq('business_id', progress.business_id).order('created_at');
            if (!venues) throw new Error("No venues");
            const currentVenueId = venues[activeIndex]?.id;

            // Wipe devices for this venue
            await supabase.from('devices').delete().eq('venue_id', currentVenueId);

            for (const [areaId, devices] of Object.entries(devicesMap)) {
                const deviceList = devices as any[];
                for (const dev of deviceList) {
                    await supabase.from('devices').insert({
                        business_id: progress.business_id,
                        venue_id: currentVenueId,
                        area_id: areaId,
                        name: dev.name,
                        direction_mode: dev.mode
                    });
                }
            }

            const nextIndex = activeIndex + 1;
            if (nextIndex < venues.length) {
                return redirect(`/onboarding?idx=${nextIndex}`);
            } else {
                // FINISH
                await supabase.from('onboarding_progress').update({
                    current_step: 999
                }).eq('user_id', user.id);

                return redirect('/dashboard');
            }
        }
    } catch (e: any) {
        await logError(user.id, `onboarding_step_${step}`, e);
        return redirect(`/onboarding?error=${encodeURIComponent(e.message || 'Error processing step')}`);
    }

    return redirect('/onboarding');
}
