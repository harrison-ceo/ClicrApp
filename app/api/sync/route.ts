import { NextResponse } from 'next/server';
import { readDB, addEvent, addScan, resetAllCounts, addUser, updateUser, removeUser, writeDB, addClicr, updateClicr, updateArea, factoryResetDB, addBan, revokeBan, isUserBanned, createPatronBan, updatePatronBan, recordBanEnforcement, addVenue, updateVenue, addArea, addDevice, updateDevice, addCapacityOverride, addVenueAuditLog, assignEntityToUser, updateBusiness, DBData } from '@/lib/db';
import { CountEvent, IDScanEvent, User, Clicr, Area, BanRecord, BanEnforcementEvent } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// --- HYDRATION HELPER ---
async function hydrateData(data: DBData): Promise<DBData> {
    try {
        // 1. Fetch Occupancy Events
        const { data: occEvents, error: occError } = await supabaseAdmin
            .from('occupancy_events')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5000);

        if (occError) console.error("Supabase Occupancy Fetch Error:", occError);

        if (!occError && occEvents) {
            // A. Calculate Live Counts
            const clicrCounts: Record<string, number> = {};
            occEvents.forEach(e => {
                const clicrId = e.session_id;
                if (clicrId) {
                    clicrCounts[clicrId] = (clicrCounts[clicrId] || 0) + e.delta;
                }
            });

            // B. Update Clicrs in Memory
            data.clicrs = data.clicrs.map((c: Clicr) => ({
                ...c,
                // Resiliency: If Supabase has data, use it. If not (e.g. write failed), keep local optimistic count.
                current_count: clicrCounts[c.id] !== undefined ? clicrCounts[c.id] : c.current_count
            }));

            // C. Replace Events History
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
            // Since we just wrote to local, we re-hydrate just in case, but usually unnecessary for new user
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

        // --- FILTERING ---
        const visibleVenueIds = user.assigned_venue_ids || [];
        const filteredVenues = data.venues.filter(v => visibleVenueIds.includes(v.id));
        const filteredAreas = data.areas.filter(a => visibleVenueIds.includes(a.venue_id));
        const visibleAreaIds = filteredAreas.map(a => a.id);
        const filteredClicrs = data.clicrs.filter(c => visibleAreaIds.includes(c.area_id));
        const filteredEvents = data.events.filter(e => visibleVenueIds.includes(e.venue_id));
        const filteredScans = data.scanEvents.filter(s => visibleVenueIds.includes(s.venue_id));

        return NextResponse.json({
            ...data,
            venues: filteredVenues,
            areas: filteredAreas,
            clicrs: filteredClicrs,
            events: filteredEvents,
            scanEvents: filteredScans,
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
                // SUPABASE PERSISTENCE
                let writeSuccess = false;
                try {
                    const { error } = await supabaseAdmin.from('occupancy_events').insert({
                        business_id: event.business_id || 'biz_001', // Fallback
                        venue_id: event.venue_id,
                        area_id: event.area_id,
                        session_id: event.clicr_id,
                        timestamp: new Date(event.timestamp).toISOString(),
                        flow_type: event.flow_type,
                        delta: event.delta,
                        event_type: event.event_type
                    });
                    if (error) throw error;
                    writeSuccess = true;
                } catch (e) {
                    console.error("Supabase Write Failed", e);
                }

                updatedData = addEvent(event);

                // Only hydrate if the write succeeded (consistency)
                // If write failed (e.g. UUID error), we rely on local memory state to avoid resetting client to 0
                if (writeSuccess) {
                    updatedData = await hydrateData(updatedData);
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
            case 'ADD_CLICR': updatedData = addClicr(payload as Clicr); break;
            case 'UPDATE_CLICR':
                const clicr = payload as Clicr;
                // PERSISTENCE: Save name/config to Supabase
                try {
                    await supabaseAdmin.from('devices').upsert({
                        id: clicr.id,
                        name: clicr.name,
                        business_id: 'biz_001', // Default falllback
                        device_type: 'COUNTER_ONLY',
                        config: { button_config: clicr.button_config }
                    });
                } catch (e) { console.error("Update Clicr Persistence Failed", e); }
                updatedData = updateClicr(clicr);
                break;

            case 'UPDATE_AREA': updatedData = updateArea(payload as Area); break;
            case 'ADD_VENUE': updatedData = addVenue(payload); break;
            case 'UPDATE_VENUE': updatedData = updateVenue(payload); break;
            case 'CREATE_BAN': updatedData = addBan(payload as BanRecord); break;
            case 'REVOKE_BAN': updatedData = revokeBan(payload.banId, payload.revokedByUserId, payload.reason); break;
            case 'CREATE_PATRON_BAN': updatedData = createPatronBan(payload.person, payload.ban, payload.log); break;
            case 'UPDATE_PATRON_BAN': updatedData = updatePatronBan(payload.ban, payload.log); break;
            case 'RECORD_BAN_ENFORCEMENT': updatedData = recordBanEnforcement(payload as BanEnforcementEvent); break;
            case 'ADD_AREA': updatedData = addArea(payload); break;
            case 'ADD_DEVICE': updatedData = addDevice(payload); break;
            case 'UPDATE_DEVICE': updatedData = updateDevice(payload); break;
            case 'ADD_CAPACITY_OVERRIDE': updatedData = addCapacityOverride(payload); break;
            case 'ADD_VENUE_AUDIT_LOG': updatedData = addVenueAuditLog(payload); break;
            case 'UPDATE_BUSINESS': updatedData = updateBusiness(payload); break;

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

                return NextResponse.json({
                    ...updatedData,
                    venues: filteredVenues,
                    areas: filteredAreas,
                    clicrs: filteredClicrs,
                    events: filteredEvents,
                    scanEvents: filteredScans,
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
