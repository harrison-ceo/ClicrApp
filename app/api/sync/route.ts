import { NextResponse } from 'next/server';
import { readDB, addEvent, addScan, resetAllCounts, addUser, updateUser, removeUser, writeDB, addClicr, updateClicr, updateArea, factoryResetDB, addBan, revokeBan, isUserBanned, createPatronBan, updatePatronBan, recordBanEnforcement, addVenue, updateVenue, addArea, addDevice, updateDevice, addCapacityOverride, addVenueAuditLog, assignEntityToUser, updateBusiness, DBData } from '@/lib/db';
import { CountEvent, IDScanEvent, User, Clicr, Area, BanRecord, BanEnforcementEvent, Venue } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// --- HYDRATION HELPER ---
// --- HYDRATION HELPER ---
async function hydrateData(data: DBData): Promise<DBData> {
    try {
        // 0. Fetch Structural Data (Source of Truth: Supabase)
        const [
            { data: sbBusinesses },
            { data: sbVenues },
            { data: sbAreas },
            { data: sbProfiles }
        ] = await Promise.all([
            supabaseAdmin.from('businesses').select('*'),
            supabaseAdmin.from('venues').select('*'),
            supabaseAdmin.from('areas').select('*'),
            supabaseAdmin.from('profiles').select('*')
        ]);

        if (sbBusinesses) {
            data.business = sbBusinesses[0] as any; // Single tenant mode for now, or use first found
        }

        if (sbVenues) {
            // Replace local venues with Supabase venues
            data.venues = sbVenues.map((v: any) => ({
                id: v.id,
                business_id: v.business_id,
                name: v.name,
                address: v.address,
                city: 'City', // Fallback as schema might differ slightly
                state: 'State',
                zip: '00000',
                capacity: v.total_capacity,
                timezone: v.timezone || 'UTC',

                // Required fields by Type
                status: 'ACTIVE',
                capacity_enforcement_mode: 'WARN_ONLY',
                created_at: v.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }));
        }

        if (sbAreas) {
            data.areas = sbAreas.map((a: any) => ({
                id: a.id,
                venue_id: a.venue_id,
                name: a.name,
                default_capacity: a.capacity,
                parent_area_id: a.parent_area_id,

                // Required fields by Type
                area_type: 'MAIN',
                counting_mode: 'MANUAL',
                is_active: true,
                created_at: a.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));
        }

        // Sync Users & Permissions
        if (sbProfiles) {
            sbProfiles.forEach((p: any) => {
                const existing = data.users.find(u => u.id === p.id);
                const businessVenues = data.venues.filter(v => v.business_id === p.business_id).map(v => v.id);
                // Users in a business get access to all its venues for now (Owner/Manager model)

                const userObj: User = {
                    id: p.id,
                    name: p.full_name || p.email?.split('@')[0] || 'User',
                    email: p.email || existing?.email || '',
                    role: p.role,
                    assigned_venue_ids: businessVenues,
                    assigned_area_ids: [], // Implicit access
                    assigned_clicr_ids: []
                };

                if (existing) {
                    Object.assign(existing, userObj);
                } else {
                    data.users.push(userObj);
                }
            });
        }

        // 1. Fetch Occupancy Snapshots (Source of Truth for Counts)
        const { data: snapshots, error: snapError } = await supabaseAdmin
            .from('occupancy_snapshots')
            .select('*');

        if (!snapError && snapshots) {
            data.areas = data.areas.map(a => {
                const snap = snapshots.find((s: any) => s.area_id === a.id);
                // We inject the true count here. 
                // However, the frontend sums up `clicr.current_count`.
                // We need to distribute this count or ensure the frontend uses `area.current_occupancy` if available.
                // For minimally invasive fix: We will set the count on a 'virtual' clicr or update existing clicrs?
                // NO, updating existing clicrs is confusing if we don't know which one contributed.
                // BEST FIX: The frontend should prioritize Area Occupancy if we send it.
                // Let's add it to the Area object.
                // Fallback Logic:
                // 1. Snapshot (Best)
                // 2. If no snapshot, try to sum from recent events (Partial fix)
                // 3. 0

                let validCount = 0;
                if (snap) {
                    validCount = snap.current_occupancy;
                } else if (!snapError && occEvents) {
                    // Try to reconstruct from events if snapshot missing
                    // This is imperfect (limit 100) but better than 0 for recent bursts
                    // Filter events for this area
                    const areaEvents = occEvents.filter((e: any) => e.area_id === a.id);
                    if (areaEvents.length > 0) {
                        validCount = areaEvents.reduce((acc: number, e: any) => acc + e.delta, 0);
                        // Since events are desc, we are just summing deltas. 
                        // This assumes start was 0.
                        // It's a weak fallback.
                    }
                }

                return {
                    ...a,
                    current_occupancy: validCount
                };
            });

            // PROPAGATION FIX:
            // Since the frontend sums `clicr.current_count` to display "Live Occupancy", we need to make sure `clicrs` reflect reality too.
            // Or we change the frontend to read `area.current_occupancy`.
            // Changing frontend is safer. But let's see if we can patch clicrs loosely.
            // If we have 1 clicr per area, easy. If multiple, hard.
            // Let's rely on Events to populate Clicr counts for "session stats", 
            // BUT use snapshots for "Total Area Occupancy".
        }

        // 2. Fetch Recent Logs (for activity feed)
        const { data: occEvents, error: occError } = await supabaseAdmin
            .from('occupancy_events')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (occError) console.error("Supabase Occupancy Fetch Error:", occError);

        if (!occError && occEvents) {
            data.events = occEvents.map((e: any) => ({
                id: e.id,
                venue_id: e.venue_id,
                area_id: e.area_id || '',
                clicr_id: e.session_id || '',
                user_id: 'system',
                business_id: e.business_id,
                timestamp: new Date(e.timestamp).getTime(),
                delta: e.delta,
                flow_type: e.flow_type as any,
                event_type: e.event_type as any,
            }));

            // RE-CALCULATE Clicr Session Counts from recent events (or all events if we fetched more)
            // Ideally Clicr counts should reset daily or per session.
            // We will let them be strictly 'session based' from the limited event window for now,
            // but the AREA count from snapshot is the "GOLDEN RECORD".
        }

        // 2. Fetch Scan Events
        const { data: scans, error: scanError } = await supabaseAdmin
            .from('scan_events')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (!scanError && scans) {
            data.scanEvents = scans.map((s: any) => ({
                ...s,
                timestamp: new Date(s.timestamp).getTime()
            })) as IDScanEvent[];
        }

        // 3. Fetch Devices (Clicr Metadata Persistence)
        const { data: devices, error: devError } = await supabaseAdmin
            .from('devices')
            .select('*');

        if (!devError && devices) {
            // Update local Clicrs with persisted names/configs
            // Also merge new devices from DB if they don't exist locally
            devices.forEach((d: any) => {
                const exists = data.clicrs.find(c => c.id === d.id);
                if (!exists && d.device_type === 'COUNTER_ONLY') {
                    data.clicrs.push({
                        id: d.id,
                        area_id: d.area_id,
                        name: d.name,
                        current_count: 0,
                        flow_mode: 'BIDIRECTIONAL',
                        active: true,
                        button_config: d.config?.button_config || {
                            left: { label: 'IN', delta: 1, color: 'green' },
                            right: { label: 'OUT', delta: -1, color: 'red' }
                        }
                    });
                }
            });

            data.clicrs = data.clicrs.map((c: Clicr) => {
                const match = devices.find((d: any) => d.id === c.id);
                if (match) {
                    return {
                        ...c,
                        name: match.name, // Persisted name
                        button_config: match.config?.button_config || c.button_config // Persisted buttons
                    };
                }
                return c;
            });
        }

    } catch (err) {
        console.error("[API] Supabase Hydration Failed:", err);
    }
    return data;
}

export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');

    let data = readDB();
    data = await hydrateData(data); // Apply Hydration

    if (userId && userEmail) {
        let user = data.users.find(u => u.id === userId);

        if (!user) {
            console.log(`[API] Auto-creating user ${userEmail} (${userId})`);

            try {
                // SELF-HEALING: Create Profile in Supabase if missing
                await supabaseAdmin.from('profiles').upsert({
                    id: userId,
                    email: userEmail,
                    role: 'OWNER',
                    full_name: userEmail.split('@')[0]
                });
            } catch (profileErr) {
                console.error("Profile auto-creation failed (ignoring to keep app alive):", profileErr);
            }

            user = {
                id: userId,
                name: userEmail.split('@')[0],
                email: userEmail,
                role: 'OWNER',
                assigned_venue_ids: [],
                assigned_area_ids: [],
                assigned_clicr_ids: []
            };
            addUser(user);
            const newData = readDB();
            newData.currentUser = user;

            // Re-hydrate logic...
            // Optimization: Just return newData with correct current count from previous hydration?
            // Safer to re-hydrate or just rely on the fact that addUser didn't touch counts.
            // Let's re-attach the counts we just calculated.
            newData.clicrs = data.clicrs;
            newData.events = data.events;
            newData.scanEvents = data.scanEvents;
            return NextResponse.json(newData);
        } else {
            data.currentUser = user;
        }

        // --- CONTEXT AWARENESS: Load User's Business ---
        try {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('business_id')
                .eq('id', userId)
                .single();

            if (profile?.business_id) {
                const { data: myBusiness } = await supabaseAdmin
                    .from('businesses')
                    .select('*')
                    .eq('id', profile.business_id)
                    .single();

                if (myBusiness) {
                    data.business = {
                        id: myBusiness.id,
                        name: myBusiness.name,
                        timezone: myBusiness.timezone || 'UTC',
                        settings: myBusiness.settings || { refresh_interval_sec: 5, capacity_thresholds: [80, 90, 100], reset_rule: 'MANUAL' }
                    };
                }
            }
        } catch (e) { console.error("Business Context Load Failed", e); }

        // --- FILTERING ---
        const visibleVenueIds = user.assigned_venue_ids || [];
        const filteredVenues = data.venues.filter(v => visibleVenueIds.includes(v.id));
        const filteredAreas = data.areas.filter(a => visibleVenueIds.includes(a.venue_id));
        const visibleAreaIds = filteredAreas.map(a => a.id);
        const filteredClicrs = data.clicrs.filter(c => visibleAreaIds.includes(c.area_id));
        const filteredEvents = data.events.filter(e => visibleVenueIds.includes(e.venue_id));
        const filteredScans = data.scanEvents.filter(s => visibleVenueIds.includes(s.venue_id));

        // SECURITY FIX: Filter Users to only those in the same scope
        const filteredUsers = data.users.filter(u =>
            u.id === user.id ||
            u.assigned_venue_ids.some(vid => visibleVenueIds.includes(vid))
        );

        return NextResponse.json({
            ...data,
            venues: filteredVenues,
            areas: filteredAreas,
            clicrs: filteredClicrs,
            events: filteredEvents,
            scanEvents: filteredScans,
            users: filteredUsers,
            currentUser: user
        });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const body = await request.json();
    const { action, payload } = body;
    const userId = request.headers.get('x-user-id');
    let updatedData: DBData | undefined;

    try {
        switch (action) {
            case 'RECORD_EVENT':
                const event = payload as CountEvent;
                if (isUserBanned(event.user_id, event.venue_id)) {
                    return NextResponse.json({ error: 'User is banned' }, { status: 403 });
                }

                // Resolve Business ID dynamically
                let eventBizId = event.business_id;
                if (!eventBizId && userId) {
                    const { data: p } = await supabaseAdmin.from('profiles').select('business_id').eq('id', userId).single();
                    if (p) eventBizId = p.business_id;
                }
                const finalEventBizId = eventBizId || 'biz_001';

                // ATOMIC UPDATE via RPC
                try {
                    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('process_occupancy_event', {
                        p_business_id: finalEventBizId,
                        p_venue_id: event.venue_id,
                        p_area_id: event.area_id,
                        p_device_id: event.clicr_id, // Map session_id to device_id better if possible, or use one field
                        p_user_id: userId || '00000000-0000-0000-0000-000000000000', // Fallback UUID
                        p_delta: event.delta,
                        p_flow_type: event.flow_type,
                        p_event_type: event.event_type,
                        p_session_id: event.clicr_id
                    });

                    if (rpcError) throw rpcError;

                    // Success - update local optimized state
                    // We can also return the new TRUE count from the RPC to the client
                    // For now, we update local memory to match
                    updatedData = addEvent(event);

                } catch (e) {
                    console.error("Supabase Atomic Update Failed", e);
                    return NextResponse.json({ error: 'Count Failed' }, { status: 500 });
                }
                break;

            case 'RECORD_SCAN':
                const scan = payload as IDScanEvent;
                // PERSIST: Save scan to Supabase
                try {
                    await supabaseAdmin.from('scan_events').insert({
                        business_id: 'biz_001',
                        venue_id: scan.venue_id,
                        timestamp: new Date(scan.timestamp).toISOString(),
                        scan_result: scan.scan_result,
                        age: scan.age,
                        gender: scan.sex, // Map sex -> gender
                        zip_code: scan.zip_code,

                        // PII Fields
                        first_name: scan.first_name,
                        last_name: scan.last_name,
                        dob: scan.dob,
                        id_number: scan.id_number,
                        issuing_state: scan.issuing_state,
                        city: scan.city,
                        address_street: scan.address_street
                    });
                } catch (e) { console.error("Scan Persistence Failed", e); }
                updatedData = addScan(scan);
                break;

            case 'RESET_COUNTS':
                if (body.venue_id) {
                    await supabaseAdmin.from('occupancy_events').delete().eq('venue_id', body.venue_id);
                    await supabaseAdmin.from('scan_events').delete().eq('venue_id', body.venue_id);
                }
                updatedData = resetAllCounts(body.venue_id);
                break;

            // ... (Pass through other cases directly) ...
            case 'ADD_USER': updatedData = addUser(payload as User); break;
            case 'UPDATE_USER': updatedData = updateUser(payload as User); break;
            case 'REMOVE_USER': updatedData = removeUser(payload.id); break;

            case 'DELETE_ACCOUNT':
                // Permanently delete user from Auth and Profile
                if (payload.id) {
                    try {
                        // 1. Delete from Supabase Auth (This usually cascades to profile if set up, but let's be sure)
                        await supabaseAdmin.auth.admin.deleteUser(payload.id);

                        // 2. Explicitly delete profile just in case
                        await supabaseAdmin.from('profiles').delete().eq('id', payload.id);

                        // 3. Update local state
                        updatedData = removeUser(payload.id);
                    } catch (e) {
                        console.error("Delete Account Failed", e);
                        return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
                    }
                }
                break;

            case 'ADD_CLICR':
                const newClicr = payload as Clicr;

                // Resolve Business
                let clicrBizId: string | null = null;
                if (userId) {
                    const { data: p } = await supabaseAdmin.from('profiles').select('business_id').eq('id', userId).single();
                    if (p) clicrBizId = p.business_id;
                }

                // Fallback for Dev/Playground or critical failure
                if (!clicrBizId) {
                    console.warn("No Business ID found for ADD_CLICR, falling back to biz_001");
                    clicrBizId = 'biz_001';
                }

                try {
                    const { error } = await supabaseAdmin.from('devices').insert({
                        id: newClicr.id,
                        business_id: clicrBizId,
                        area_id: newClicr.area_id,
                        name: newClicr.name,
                        pairing_code: newClicr.command || null,
                        device_type: 'COUNTER_ONLY',
                        is_active: newClicr.active ?? true,
                        config: { button_config: newClicr.button_config }
                    });

                    if (error) {
                        console.error("ADD_CLICR persistence failed", error);
                        return NextResponse.json({ error: `Database Insert Failed: ${error.message} (${error.code})` }, { status: 500 });
                    }
                } catch (e: any) {
                    console.error("ADD_CLICR persistence exception", e);
                    return NextResponse.json({ error: 'Server Error: ' + e.message }, { status: 500 });
                }

                updatedData = addClicr(newClicr);
                break;
            case 'UPDATE_VENUE':
                const venue = payload as Venue;
                try {
                    await supabaseAdmin.from('venues').update({
                        name: venue.name,
                        // address, etc. (map if needed)
                        total_capacity: venue.default_capacity_total,
                        capacity_enforcement_mode: venue.capacity_enforcement_mode,
                        status: venue.status
                    }).eq('id', venue.id);
                } catch (e) {
                    console.error("Update Venue Persistence Failed", e);
                    // Don't block flow, but log
                }
                updatedData = updateVenue(venue);
                break;

            case 'UPDATE_AREA':
                const areaPayload = payload as Area;
                try {
                    await supabaseAdmin.from('areas').update({
                        name: areaPayload.name,
                        capacity: areaPayload.default_capacity
                    }).eq('id', areaPayload.id);
                } catch (e) {
                    console.error("Update Area Persistence Failed", e);
                    return NextResponse.json({ error: 'Update Failed' }, { status: 500 });
                }
                updatedData = updateArea(areaPayload);
                break;

            case 'DELETE_CLICR':
                const delPayload = payload as { id: string };
                try {
                    // Soft delete
                    const { error } = await supabaseAdmin.from('devices')
                        .update({ deleted_at: new Date().toISOString() })
                        .eq('id', delPayload.id);

                    if (error) {
                        console.error("DELETE_CLICR persistence failed", error); // Log full error object
                        return NextResponse.json({ error: `Delete Failed: ${error.message} (${error.code})` }, { status: 500 });
                    }

                    // Update local state
                    updatedData = readDB();
                    updatedData.clicrs = updatedData.clicrs.filter(c => c.id !== delPayload.id);
                    writeDB(updatedData);

                } catch (e: any) {
                    console.error("DELETE_CLICR Exception", e);
                    return NextResponse.json({ error: 'Server Error: ' + e.message }, { status: 500 });
                }
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // --- CRITICAL FIX: HYDRATE RESPONSE ---
        // Before returning, we MUST hydrate the data from Supabase so the client gets the real counts
        // especially for events/scans/resets
        if (['RECORD_SCAN', 'RESET_COUNTS', 'UPDATE_CLICR'].includes(action) && updatedData) {
            updatedData = await hydrateData(updatedData);
        }

        // --- AUTO-ASSIGNMENT & FILTERING ---
        if (userId && updatedData) {
            // FIX: Restore correct business context for this user (otherwise hydrateData resets it to default)
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('business_id')
                    .eq('id', userId)
                    .single();

                if (profile?.business_id) {
                    const { data: myBusiness } = await supabaseAdmin
                        .from('businesses')
                        .select('*')
                        .eq('id', profile.business_id)
                        .single();

                    if (myBusiness) {
                        updatedData.business = {
                            id: myBusiness.id,
                            name: myBusiness.name,
                            timezone: myBusiness.timezone || 'UTC',
                            settings: myBusiness.settings || { refresh_interval_sec: 5, capacity_thresholds: [80, 90, 100], reset_rule: 'MANUAL' }
                        };
                    }
                }
            } catch (e) { console.error("Business Context Load Failed (POST)", e); }

            if (action === 'ADD_VENUE') updatedData = assignEntityToUser(userId, 'VENUE', payload.id);
            if (action === 'ADD_AREA') updatedData = assignEntityToUser(userId, 'AREA', payload.id);
            if (action === 'ADD_CLICR') updatedData = assignEntityToUser(userId, 'CLICR', payload.id);

            const user = updatedData.users.find(u => u.id === userId);
            if (user) {
                const visibleVenueIds = user.assigned_venue_ids || [];
                const filteredVenues = updatedData.venues.filter(v => visibleVenueIds.includes(v.id));
                const filteredAreas = updatedData.areas.filter(a => visibleVenueIds.includes(a.venue_id));
                const visibleAreaIds = filteredAreas.map(a => a.id);
                const filteredClicrs = updatedData.clicrs.filter(c => visibleAreaIds.includes(c.area_id));
                const filteredEvents = updatedData.events.filter(e => visibleVenueIds.includes(e.venue_id));
                const filteredScans = updatedData.scanEvents.filter(s => visibleVenueIds.includes(s.venue_id));

                // SECURITY FIX: Filter Users to only those in the same scope
                const filteredUsers = updatedData.users.filter(u =>
                    u.id === user.id ||
                    u.assigned_venue_ids.some(vid => visibleVenueIds.includes(vid))
                );

                return NextResponse.json({
                    ...updatedData,
                    venues: filteredVenues,
                    areas: filteredAreas,
                    clicrs: filteredClicrs,
                    events: filteredEvents,
                    scanEvents: filteredScans,
                    users: filteredUsers,
                    currentUser: user
                });
            }
        }

        return NextResponse.json(updatedData);
    } catch (error) {
        console.error("API Error", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
