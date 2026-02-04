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
            data.business = sbBusinesses[0] as unknown as any; // Temporary bypass for mismatched schema logic
        }

        if (sbVenues) {
            // Replace local venues with Supabase venues
            data.venues = sbVenues.map((v) => ({
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
            data.areas = sbAreas.map((a) => ({
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
            sbProfiles.forEach((p) => {
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
            // SELF-HEALING: Identify areas missing snapshots and create them
            const missingSnapshotAreas = data.areas.filter(a => !snapshots.find((s) => s.area_id === a.id));

            if (missingSnapshotAreas.length > 0) {
                console.warn(`[Hydration] Found ${missingSnapshotAreas.length} areas missing snapshots. Creating...`);
                await Promise.all(missingSnapshotAreas.map(async (a) => {
                    try {
                        // Resolve Business ID from Venues
                        const venue = data.venues.find(v => v.id === a.venue_id);
                        const bizId = venue?.business_id || 'biz_001';

                        await supabaseAdmin.from('occupancy_snapshots').insert({
                            business_id: bizId,
                            venue_id: a.venue_id,
                            area_id: a.id,
                            current_occupancy: 0,
                            updated_at: new Date().toISOString()
                        });
                        console.log(`[Hydration] Created missing snapshot for Area: ${a.id}`);
                    } catch (e) {
                        console.error(`[Hydration] Failed to create snapshot for ${a.id}`, e);
                    }
                }));
            }

            // Map snapshots to areas
            data.areas = data.areas.map(a => {
                const snap = snapshots.find((s) => s.area_id === a.id);
                // If we just created it, it might not be in 'snapshots' array yet unless we refetch.
                // But we can safely default to 0 here IF we know we just created it.
                // However, better robustness is to use the snap if found, else 0 (since we know we tried to create it).

                let validCount = snap ? snap.current_occupancy : 0;

                // Fallback: If snapshot is 0 but we have events, do we trust events?
                // Spec says: Snapshot is Authoritative. So we trust validCount.

                return {
                    ...a,
                    current_occupancy: validCount
                };
            });
        }

        // 2. Fetch Recent Logs (for activity feed)
        const { data: occEvents, error: occError } = await supabaseAdmin
            .from('occupancy_events')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (occError) console.error("Supabase Occupancy Fetch Error:", occError);

        if (!occError && occEvents) {
            data.events = occEvents.map((e) => ({
                id: e.id,
                venue_id: e.venue_id,
                area_id: e.area_id || '',
                clicr_id: e.session_id || '',
                user_id: 'system',
                business_id: e.business_id,
                timestamp: new Date(e.timestamp).getTime(),
                delta: e.delta,
                flow_type: e.flow_type,
                event_type: e.event_type,
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
            data.scanEvents = scans.map((s) => ({
                ...s,
                timestamp: new Date(s.timestamp).getTime()
            })) as IDScanEvent[];
        }

        // 3. Fetch Devices (Clicr Metadata Persistence)
        const { data: devices, error: devError } = await supabaseAdmin
            .from('devices')
            .select('*')
            .is('deleted_at', null); // IMPORTANT: Filter out soft deleted rows

        if (!devError && devices) {
            // Update local Clicrs with persisted names/configs
            // Also merge new devices from DB if they don't exist locally
            devices.forEach((d) => {
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
                const match = devices.find((d) => d.id === c.id);
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

            // SELF-HEALING: Create Profile in Supabase if missing
            await supabaseAdmin.from('profiles').upsert({
                id: userId,
                email: userEmail,
                role: 'OWNER',
                full_name: userEmail.split('@')[0]
            });

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
                    const rpcParams = {
                        p_business_id: finalEventBizId,
                        p_venue_id: event.venue_id,
                        p_area_id: event.area_id,
                        p_device_id: event.clicr_id,
                        p_user_id: userId || '00000000-0000-0000-0000-000000000000',
                        p_delta: event.delta,
                        p_flow_type: event.flow_type,
                        p_event_type: event.event_type,
                        p_session_id: event.clicr_id
                    };
                    const { error: rpcError } = await supabaseAdmin.rpc('process_occupancy_event', rpcParams);

                    if (rpcError) {
                        console.error("RPC Error Details:", JSON.stringify(rpcError, null, 2));
                        console.error("RPC Params:", JSON.stringify(rpcParams, null, 2));
                        throw rpcError;
                    }

                    // Success - update local optimized state
                    updatedData = addEvent(event);

                } catch (e) {
                    console.error("Supabase Atomic Update Failed Exception", e);
                    return NextResponse.json({ error: `Count Failed: ${(e as Error).message}` }, { status: 500 });
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
                const resetPayload = payload || {};
                const resetAreaId = resetPayload.area_id; // Support granular Area reset
                const resetVenueId = body.venue_id || resetPayload.venue_id;

                console.log(`[API] Resetting counts for Venue: ${resetVenueId}, Area: ${resetAreaId}`);

                try {
                    // Correct Logical Reset: Don't delete history, just zero out current state.
                    const updateQuery = { current_occupancy: 0, updated_at: new Date().toISOString() };

                    if (resetAreaId) {
                        // Reset Specific Area
                        await supabaseAdmin.from('occupancy_snapshots')
                            .update(updateQuery)
                            .eq('area_id', resetAreaId);

                        // Log Event
                        await supabaseAdmin.from('occupancy_events').insert({
                            business_id: 'biz_001', // Should resolve properly
                            venue_id: resetVenueId,
                            area_id: resetAreaId,
                            timestamp: new Date().toISOString(),
                            flow_type: 'RESET',
                            delta: 0, // Delta is tricky here. Ideally -current.
                            event_type: 'MANUAL_RESET'
                        });

                    } else if (resetVenueId) {
                        // Reset All Areas in Venue
                        await supabaseAdmin.from('occupancy_snapshots')
                            .update(updateQuery)
                            .eq('venue_id', resetVenueId);
                    }

                    // For now, we still rely on local resetAllCounts to update the memory cache
                    // But we MUST NOT clear the `events` array if we want history.
                    // However, `resetAllCounts` in db.ts wipes events.
                    // We should update `resetAllCounts` to NOT wipe events, or just manage state here.

                    // Let's just update the local state to match the reset.
                    const dbData = readDB();
                    dbData.areas = dbData.areas.map(a => {
                        if (resetAreaId && a.id === resetAreaId) return { ...a, current_occupancy: 0 };
                        if (resetVenueId && a.venue_id === resetVenueId) return { ...a, current_occupancy: 0 };
                        return a;
                    });
                    // Don't wipe events array in memory/file, just update current counts.
                    writeDB(dbData);
                    updatedData = dbData;

                } catch (e) {
                    console.error("Reset Failed", e);
                    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
                }
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
                } catch (e) {
                    console.error("ADD_CLICR persistence exception", e);
                    return NextResponse.json({ error: 'Server Error: ' + (e as Error).message }, { status: 500 });
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
                if (!delPayload || !delPayload.id) {
                    return NextResponse.json({ error: 'Missing device ID' }, { status: 400 });
                }

                console.log(`[API] Attempting DELETE_CLICR for ID: ${delPayload.id} by User: ${userId}`);

                try {
                    // 1. Check permissions (manager/owner only)
                    // (Assuming basic auth handled by route, but could refine here if needed)

                    // 2. Perform Soft Delete
                    // We also want to record WHO deleted it.
                    const { error, data: deletedRow } = await supabaseAdmin.from('devices')
                        .update({
                            deleted_at: new Date().toISOString(),
                            deleted_by: userId
                        })
                        .eq('id', delPayload.id)
                        .select()
                        .single();

                    if (error) {
                        console.error("[API] DELETE_CLICR Persistence Failed", error);

                        // Construct user-friendly error
                        let userMsg = `Database Error: ${error.message}`;
                        if (error.code === '42501') userMsg = 'Permission Denied: You cannot delete this device.';
                        if (error.code === '23503') userMsg = 'Constraint Violation: Historical records depend on this device.';

                        return NextResponse.json({ error: userMsg, details: error }, { status: 500 });
                    }

                    if (!deletedRow) {
                        console.warn("[API] DELETE_CLICR: No row updated. ID might be wrong or already deleted.");
                        // Not an error per se, but UI might want to know.
                    } else {
                        console.log(`[API] Soft deleted device: ${delPayload.id}`);
                    }

                    // 3. Update local state
                    updatedData = readDB();
                    updatedData.clicrs = updatedData.clicrs.filter(c => c.id !== delPayload.id);
                    writeDB(updatedData);

                } catch (e) {
                    console.error("[API] DELETE_CLICR Exception", e);
                    return NextResponse.json({ error: 'Server Exception: ' + (e as Error).message }, { status: 500 });
                }
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // --- CRITICAL FIX: HYDRATE RESPONSE ---
        // Vercel readDB() returns mocks. We MUST hydrate to get real Venues/Areas so filtering works.
        // We should basically always hydrate for any structural change.
        if (['RECORD_SCAN', 'RESET_COUNTS', 'UPDATE_CLICR', 'ADD_CLICR', 'DELETE_CLICR', 'ADD_VENUE', 'ADD_AREA', 'ADD_DEVICE', 'UPDATE_VENUE', 'UPDATE_AREA'].includes(action) && updatedData) {
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
        return NextResponse.json({ error: `Internal Server Error: ${(error as Error).message}` }, { status: 500 });
    }
}
