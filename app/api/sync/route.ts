import { NextResponse } from 'next/server';
import { readDB, addEvent, addScan, resetAllCounts, addUser, updateUser, removeUser, writeDB, addClicr, updateClicr, updateArea, factoryResetDB, addBan, revokeBan, isUserBanned, createPatronBan, updatePatronBan, recordBanEnforcement, addVenue, updateVenue, addArea, addDevice, updateDevice, addCapacityOverride, addVenueAuditLog, assignEntityToUser, updateBusiness } from '@/lib/db';
import { CountEvent, IDScanEvent, User, Clicr, Area, BanRecord, BanEnforcementEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');

    const data = readDB();

    if (userId && userEmail) {
        let user = data.users.find(u => u.id === userId);

        // AUTO-ONBOARDING: Create user if they don't exist in our JSON DB yet
        if (!user) {
            console.log(`[API] Auto-creating user ${userEmail} (${userId})`);
            user = {
                id: userId,
                name: userEmail.split('@')[0], // Fallback name
                email: userEmail,
                role: 'OWNER', // Default to Owner for new signups
                assigned_venue_ids: [],
                assigned_area_ids: [],
                assigned_clicr_ids: []
            };
            addUser(user);
            // Refresh data after write
            const newData = readDB();
            newData.currentUser = user;
            return NextResponse.json(newData);
        } else {
            // Found existing user, set as current for the frontend context
            data.currentUser = user;
        }

        // --- FILTERING FOR MULTI-TENANCY ---
        // Only return data relevant to this user
        // (For the PROD Schema we use RLS, but for this JSON mock we filter manually)

        // 1. Filter Venues
        // If OWNER and no assignments, maybe they own the business? 
        // For simplicity in this hybrid mode: Strict assignment matching.
        // Users must be assigned venues to see them.

        const visibleVenueIds = user.assigned_venue_ids || [];
        // If user is freshly created, this is empty.

        const filteredVenues = data.venues.filter(v => visibleVenueIds.includes(v.id));
        const filteredAreas = data.areas.filter(a => visibleVenueIds.includes(a.venue_id)); // Allow all areas in visible venues
        const visibleAreaIds = filteredAreas.map(a => a.id);
        const filteredClicrs = data.clicrs.filter(c => visibleAreaIds.includes(c.area_id));
        const filteredEvents = data.events.filter(e => visibleVenueIds.includes(e.venue_id));
        const filteredScans = data.scanEvents.filter(s => visibleVenueIds.includes(s.venue_id));

        // Return the filtered view
        return NextResponse.json({
            ...data,
            venues: filteredVenues,
            areas: filteredAreas,
            clicrs: filteredClicrs,
            events: filteredEvents,
            scanEvents: filteredScans,
            currentUser: user // Ensure client gets the correct user object
        });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const body = await request.json();
    console.log("API Sync POST received:", body);
    const { action, payload } = body;

    // Get User Context
    const userId = request.headers.get('x-user-id');

    let updatedData;

    try {
        switch (action) {
            case 'RECORD_EVENT':
                const event = payload as CountEvent;
                if (isUserBanned(event.user_id, event.venue_id)) {
                    console.warn(`Blocked banned user ${event.user_id} from recording event.`);
                    return NextResponse.json({ error: 'User is banned from accessing this venue' }, { status: 403 });
                }
                updatedData = addEvent(event);
                break;
            case 'RECORD_SCAN':
                updatedData = addScan(payload as IDScanEvent);
                break;
            case 'RESET_COUNTS':
                updatedData = resetAllCounts(body.venue_id);
                break;
            case 'ADD_USER':
                updatedData = addUser(payload as User);
                break;
            case 'UPDATE_USER':
                updatedData = updateUser(payload as User);
                break;
            case 'REMOVE_USER':
                updatedData = removeUser(payload.id);
                break;
            case 'ADD_CLICR':
                updatedData = addClicr(payload as Clicr);
                break;
            case 'UPDATE_CLICR':
                updatedData = updateClicr(payload as Clicr);
                break;
            case 'UPDATE_AREA':
                updatedData = updateArea(payload as Area);
                break;
            case 'CREATE_BAN':
                updatedData = addBan(payload as BanRecord);
                break;
            case 'REVOKE_BAN':
                updatedData = revokeBan(payload.banId, payload.revokedByUserId, payload.reason);
                break;
            case 'CREATE_PATRON_BAN':
                updatedData = createPatronBan(payload.person, payload.ban, payload.log);
                break;
            case 'UPDATE_PATRON_BAN':
                updatedData = updatePatronBan(payload.ban, payload.log);
                break;
            case 'RECORD_BAN_ENFORCEMENT':
                updatedData = recordBanEnforcement(payload as BanEnforcementEvent);
                break;
            case 'ADD_VENUE':
                updatedData = addVenue(payload);
                break;
            case 'UPDATE_VENUE':
                updatedData = updateVenue(payload);
                break;
            case 'ADD_AREA':
                updatedData = addArea(payload);
                break;
            case 'ADD_DEVICE':
                updatedData = addDevice(payload);
                break;
            case 'UPDATE_DEVICE':
                updatedData = updateDevice(payload);
                break;
            case 'ADD_CAPACITY_OVERRIDE':
                updatedData = addCapacityOverride(payload);
                break;
            case 'ADD_VENUE_AUDIT_LOG':
                updatedData = addVenueAuditLog(payload);
                break;
            case 'UPDATE_BUSINESS':
                updatedData = updateBusiness(payload);
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // --- AUTO-ASSIGNMENT ---
        if (userId && updatedData) {
            if (action === 'ADD_VENUE') {
                updatedData = assignEntityToUser(userId, 'VENUE', payload.id);
            } else if (action === 'ADD_AREA') {
                updatedData = assignEntityToUser(userId, 'AREA', payload.id);
            } else if (action === 'ADD_CLICR') {
                updatedData = assignEntityToUser(userId, 'CLICR', payload.id);
            }
        }

        // --- FILTERING RETURN DATA ---
        if (userId && updatedData) {
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
