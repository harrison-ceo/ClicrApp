import fs from 'fs';
import path from 'path';

import { Business, Venue, Area, Clicr, CountEvent, User, IDScanEvent, BanRecord, BannedPerson, PatronBan, BanEnforcementEvent, BanAuditLog, Device, CapacityOverride, VenueAuditLog, SupportTicket, SupportMessage } from './types';


const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Initial Mock Data (Moved from store.tsx)
const INITIAL_BUSINESS: Business = {
    id: 'biz_001',
    name: 'My Organization',
    timezone: 'America/New_York',
    settings: {
        refresh_interval_sec: 5,
        capacity_thresholds: [80, 90, 100],
        reset_rule: 'MANUAL',
    },
};

const INITIAL_VENUES: Venue[] = [
    {
        id: 'ven_001',
        business_id: 'biz_001',
        name: 'The Neon Lounge',
        active: true, // Legacy
        status: 'ACTIVE',
        timezone: 'America/New_York',
        capacity_enforcement_mode: 'WARN_ONLY',
        default_capacity_total: 500,
        city: 'New York',
        state: 'NY',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'ven_002',
        business_id: 'biz_001',
        name: 'Rooftop Garden',
        active: true,
        status: 'ACTIVE',
        timezone: 'America/New_York',
        capacity_enforcement_mode: 'WARN_ONLY',
        default_capacity_total: 200,
        city: 'New York',
        state: 'NY',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
];

const INITIAL_AREAS: Area[] = [
    { id: 'area_001', venue_id: 'ven_001', name: 'Main Floor', default_capacity: 300, is_active: true, active: true, area_type: 'MAIN', counting_mode: 'BOTH', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'area_002', venue_id: 'ven_001', name: 'VIP Section', default_capacity: 50, is_active: true, active: true, area_type: 'VIP', counting_mode: 'BOTH', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'area_003', venue_id: 'ven_002', name: 'Terrace', default_capacity: 150, is_active: true, active: true, area_type: 'PATIO', counting_mode: 'BOTH', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const INITIAL_CLICRS: Clicr[] = [
    { id: 'clicr_001', area_id: 'area_001', name: 'Entrance', flow_mode: 'BIDIRECTIONAL', current_count: 0, active: true },
    { id: 'clicr_002', area_id: 'area_001', name: 'Exit', flow_mode: 'BIDIRECTIONAL', current_count: 0, active: true },
];

const INITIAL_DEVICES: Device[] = [
    // Migrating Clicrs to Devices conceptually
    { id: 'dev_001', business_id: 'biz_001', venue_id: 'ven_001', area_id: 'area_001', device_type: 'COUNTER', device_name: 'Main Entrance iPad', serial_number: 'SN123456', status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const INITIAL_USER: User = {
    id: 'usr_owner',
    name: 'Harrison Owner',
    email: 'owner@clicr.com',
    phone: '555-0123',
    role: 'OWNER',
    assigned_venue_ids: ['ven_001', 'ven_002'],
    assigned_area_ids: ['area_001', 'area_002', 'area_003'],
    assigned_clicr_ids: ['clicr_001', 'clicr_002'],
};

type DBData = {
    business: Business;
    venues: Venue[];
    areas: Area[];
    clicrs: Clicr[];
    devices: Device[];
    capacityOverrides: CapacityOverride[];
    venueAuditLogs: VenueAuditLog[];
    events: CountEvent[];
    scanEvents: IDScanEvent[];
    currentUser: User;
    users: User[];
    bans: BanRecord[]; // Staff Banning

    // Patron Banning System
    patrons: BannedPerson[];
    patronBans: PatronBan[];
    banAuditLogs: BanAuditLog[];
    banEnforcementEvents: BanEnforcementEvent[];

    // Support
    tickets: SupportTicket[];
};

const INITIAL_DB: DBData = {
    business: INITIAL_BUSINESS,
    venues: INITIAL_VENUES,
    areas: INITIAL_AREAS,
    clicrs: INITIAL_CLICRS,
    devices: INITIAL_DEVICES,
    capacityOverrides: [],
    venueAuditLogs: [],
    events: [],
    scanEvents: [],
    currentUser: INITIAL_USER,
    users: [INITIAL_USER],
    bans: [],
    patrons: [],
    patronBans: [],
    banAuditLogs: [],
    banEnforcementEvents: [],
    tickets: [],
};

function ensureDir() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function readDB(): DBData {
    ensureDir();
    if (!fs.existsSync(DB_PATH)) {
        writeDB(INITIAL_DB);
        return INITIAL_DB;
    }
    try {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(data);

        // AUTO-MIGRATION: Ensure new fields exist
        if (!parsed.bans) parsed.bans = [];
        if (!parsed.patrons) parsed.patrons = [];
        if (!parsed.patronBans) parsed.patronBans = [];
        if (!parsed.banAuditLogs) parsed.banAuditLogs = [];
        if (!parsed.banEnforcementEvents) parsed.banEnforcementEvents = [];
        if (!parsed.tickets) parsed.tickets = [];

        // Venues Features
        if (!parsed.devices) parsed.devices = INITIAL_DEVICES;
        if (!parsed.capacityOverrides) parsed.capacityOverrides = [];
        if (!parsed.venueAuditLogs) parsed.venueAuditLogs = [];

        // Ensure other lists exist just in case
        if (!parsed.events) parsed.events = [];
        if (!parsed.scanEvents) parsed.scanEvents = [];
        if (!parsed.users) parsed.users = [INITIAL_USER];

        return parsed;
    } catch (error) {
        console.error("Error reading DB, resetting:", error);
        return INITIAL_DB;
    }
}

export function writeDB(data: DBData) {
    ensureDir();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function addVenue(venue: Venue) {
    const data = readDB();
    data.venues.push(venue);
    writeDB(data);
    return data;
}

export function updateVenue(venue: Venue) {
    const data = readDB();
    data.venues = data.venues.map(v => v.id === venue.id ? venue : v);
    writeDB(data);
    return data;
}

export function addArea(area: Area) {
    const data = readDB();
    data.areas.push(area);
    writeDB(data);
    return data;
}



export function addDevice(device: Device) {
    const data = readDB();
    data.devices.push(device);
    writeDB(data);
    return data;
}

export function updateDevice(device: Device) {
    const data = readDB();
    data.devices = data.devices.map(d => d.id === device.id ? device : d);
    writeDB(data);
    return data;
}

export function addCapacityOverride(override: CapacityOverride) {
    const data = readDB();
    data.capacityOverrides.push(override);
    writeDB(data);
    return data;
}

export function addVenueAuditLog(log: VenueAuditLog) {
    const data = readDB();
    data.venueAuditLogs.push(log);
    writeDB(data);
    return data;
}

export function addClicr(clicr: Clicr) {
    const data = readDB();
    data.clicrs.push(clicr);
    writeDB(data);
    return data;
}

export function updateClicr(clicr: Clicr) {
    const data = readDB();
    data.clicrs = data.clicrs.map(c => c.id === clicr.id ? clicr : c);
    writeDB(data);
    return data;
}

export function updateArea(area: Area) {
    const data = readDB();
    data.areas = data.areas.map(a => a.id === area.id ? area : a);
    writeDB(data);
    return data;
}

export function updateClicrCount(clicrId: string, delta: number) {
    const data = readDB();
    const clicrs = data.clicrs.map(c => {
        if (c.id === clicrId) {
            return { ...c, current_count: c.current_count + delta };
        }
        return c;
    });
    data.clicrs = clicrs;
    writeDB(data);
    return data;
}

export function addEvent(event: CountEvent) {
    const data = readDB();
    data.events.unshift(event);

    // Update cached count on clicr
    data.clicrs = data.clicrs.map(c => {
        if (c.id === event.clicr_id) {
            return { ...c, current_count: c.current_count + event.delta };
        }
        return c;
    });

    writeDB(data);
    return data;
}

export function addScan(scan: IDScanEvent) {
    const data = readDB();
    data.scanEvents.unshift(scan);
    writeDB(data);
    return data;
}

export function addUser(user: User) {
    const data = readDB();
    // Check if user exists (simple check by ID or Email)
    if (!data.users.find(u => u.id === user.id || u.email === user.email)) {
        data.users.push(user);
        writeDB(data);
    }
    return data;
}

export function updateUser(user: User) {
    const data = readDB();
    data.users = data.users.map(u => u.id === user.id ? user : u);
    writeDB(data);
    return data;
}

export function removeUser(userId: string) {
    const data = readDB();
    data.users = data.users.filter(u => u.id !== userId);
    writeDB(data);
    return data;
}

export function assignEntityToUser(userId: string, entityType: 'VENUE' | 'AREA' | 'CLICR', entityId: string) {
    const data = readDB();
    const user = data.users.find(u => u.id === userId);
    if (user) {
        if (entityType === 'VENUE' && !user.assigned_venue_ids.includes(entityId)) {
            user.assigned_venue_ids.push(entityId);
        } else if (entityType === 'AREA' && !user.assigned_area_ids.includes(entityId)) {
            user.assigned_area_ids.push(entityId);
        } else if (entityType === 'CLICR' && !user.assigned_clicr_ids.includes(entityId)) {
            user.assigned_clicr_ids.push(entityId);
        }
        writeDB(data);
    }
    return data;
}

export function addBan(ban: BanRecord) {
    const data = readDB();
    data.bans.push(ban);

    // cleanup assignments if banned
    if (ban.status === 'ACTIVE') {
        const userIndex = data.users.findIndex(u => u.id === ban.user_id);
        if (userIndex !== -1) {
            const user = data.users[userIndex];

            // If Business Ban, remove ALL assignments
            if (ban.scope_type === 'BUSINESS') {
                user.assigned_venue_ids = [];
                user.assigned_area_ids = [];
                user.assigned_clicr_ids = [];
            }
            // If Venue Ban, remove assignments related to those venues
            else if (ban.scope_type === 'VENUE') {
                const bannedVenueIds = ban.scope_venue_ids;

                // Remove venues
                user.assigned_venue_ids = user.assigned_venue_ids.filter(vid => !bannedVenueIds.includes(vid));

                // Remove areas in those venues
                const bannedAreaIds = data.areas.filter(a => bannedVenueIds.includes(a.venue_id)).map(a => a.id);
                user.assigned_area_ids = user.assigned_area_ids.filter(aid => !bannedAreaIds.includes(aid));

                // Remove clicrs in those areas (or venues)
                // Clicr -> Area -> Venue. 
                const bannedClicrIds = data.clicrs.filter(c => bannedAreaIds.includes(c.area_id)).map(c => c.id);
                user.assigned_clicr_ids = user.assigned_clicr_ids.filter(cid => !bannedClicrIds.includes(cid));
            }

            data.users[userIndex] = user;
        }
    }

    writeDB(data);
    return data;
}

export function revokeBan(banId: string, revokedByUserId: string, reason?: string) {
    const data = readDB();
    data.bans = data.bans.map(b => {
        if (b.id === banId) {
            return {
                ...b,
                status: 'REVOKED',
                revoked_by_user_id: revokedByUserId,
                revoked_at: Date.now(),
                revoked_reason: reason
            };
        }
        return b;
    });
    writeDB(data);
    return data;
}

export function resetAllCounts(venueId?: string) {
    try {
        const data = readDB();

        if (venueId) {
            // VENUE SPECIFIC RESET
            console.log(`Resetting counts for venue: ${venueId}`);

            // 1. Identify Areas belonging to this Venue
            const targetAreaIds = data.areas.filter(a => a.venue_id === venueId).map(a => a.id);

            // 2. Identify Clicrs in those Areas
            const targetClicrIds = data.clicrs.filter(c => targetAreaIds.includes(c.area_id)).map(c => c.id);

            // 3. Reset Clicrs
            data.clicrs = data.clicrs.map(c => {
                if (targetClicrIds.includes(c.id)) {
                    return { ...c, current_count: 0 };
                }
                return c;
            });

            // 4. Remove Events for this Venue Only
            // Events have venue_id directly, so this is easy
            data.events = data.events.filter(e => e.venue_id !== venueId);

            // 5. Remove Scan Events for this Venue Only
            data.scanEvents = data.scanEvents.filter(s => s.venue_id !== venueId);

        } else {
            // GLOBAL RESET (Legacy/Admin)
            console.log('Resetting ALL counts globally.');
            data.clicrs = data.clicrs.map(c => ({ ...c, current_count: 0 }));
            data.events = [];
            data.scanEvents = [];
        }

        writeDB(data);
        return data;
    } catch (error) {
        console.error("Critical DB Reset Error", error);
        throw error;
    }
}


// --- PATRON BANNING SYSTEM FUNCTIONS ---

export function createPatronBan(person: BannedPerson, ban: PatronBan, log: BanAuditLog) {
    const data = readDB();

    const existingPersonIndex = data.patrons.findIndex(p => p.id === person.id);
    if (existingPersonIndex >= 0) {
        data.patrons[existingPersonIndex] = person;
    } else {
        data.patrons.push(person);
    }

    data.patronBans.push(ban);
    data.banAuditLogs.push(log);
    writeDB(data);
    return data;
}

export function updatePatronBan(ban: PatronBan, log: BanAuditLog) {
    const data = readDB();
    const index = data.patronBans.findIndex(b => b.id === ban.id);
    if (index !== -1) {
        data.patronBans[index] = ban;
        data.banAuditLogs.push(log);
        writeDB(data);
    }
    return data;
}

export function recordBanEnforcement(event: BanEnforcementEvent) {
    const data = readDB();
    data.banEnforcementEvents.unshift(event);
    writeDB(data);
    return data;
}

export function findActivePatronBan(firstName: string, lastName: string, dob: string | undefined, venueId: string) {
    const data = readDB();

    // 1. Find potential people matches
    const matchingPeople = data.patrons.filter(p => {
        const nameMatch = p.first_name.toLowerCase() === firstName.toLowerCase() &&
            p.last_name.toLowerCase() === lastName.toLowerCase();

        const dobMatch = dob ? p.date_of_birth === dob : true;

        return nameMatch && dobMatch;
    });

    if (matchingPeople.length === 0) return null;

    // 2. Check for active bans for these people
    const personIds = matchingPeople.map(p => p.id);
    const activeBans = data.patronBans.filter(b =>
        personIds.includes(b.banned_person_id) &&
        b.status === 'ACTIVE' &&
        (b.applies_to_all_locations || b.location_ids.includes(venueId))
    );

    // Filter out expired bans just in case status wasn't updated
    const validBans = activeBans.filter(b => {
        if (b.ban_type === 'TEMPORARY' && b.end_datetime) {
            return new Date(b.end_datetime).getTime() > Date.now();
        }
        return true;
    });

    if (validBans.length === 0) return null;

    // Return the match
    return {
        ban: validBans[0],
        person: matchingPeople.find(p => p.id === validBans[0].banned_person_id)!
    };
}

export function isUserBanned(userId: string, venueId?: string): boolean {
    const data = readDB();
    const userBans = data.bans.filter(b => b.user_id === userId && b.status === 'ACTIVE');

    // Check for Business Ban
    if (userBans.some(b => b.scope_type === 'BUSINESS')) {
        return true;
    }

    // Check for Venue Ban
    if (venueId && userBans.some(b => b.scope_type === 'VENUE' && b.scope_venue_ids.includes(venueId))) {
        return true;
    }

    return false;
}

// ... existing functions ...

export function updateBusiness(updates: Partial<Business>) {
    const data = readDB();
    if (data.business) {
        data.business = { ...data.business, ...updates };
        writeDB(data);
    }
    return data;
}

// WARNING: This is a DESTRUCTIVE RESET specifically for debugging persistent state issues.
export function factoryResetDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            fs.unlinkSync(DB_PATH); // Hard delete the file
        }
        writeDB(INITIAL_DB); // Re-write fresh from code constants
        return INITIAL_DB;
    } catch (error) {
        console.error("Factory Reset Error", error);
        throw error;
    }
}

// --- SUPPORT TICKET SYSTEM ---

export function createTicket(ticket: SupportTicket) {
    const data = readDB();
    data.tickets.unshift(ticket);
    writeDB(data);
    return data;
}

export function addMessageToTicket(ticketId: string, message: SupportMessage) {
    const data = readDB();
    const index = data.tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
        data.tickets[index].messages.push(message);
        data.tickets[index].updated_at = new Date().toISOString();
        writeDB(data);
    }
    return data;
}

export function updateTicketStatus(ticketId: string, status: SupportTicket['status']) {
    const data = readDB();
    const index = data.tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
        data.tickets[index].status = status;
        data.tickets[index].updated_at = new Date().toISOString();
        writeDB(data);
    }
    return data;
}

export function getTickets(userId?: string) {
    const data = readDB();
    // Sort buy newest first
    const sorted = data.tickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (userId) {
        return sorted.filter(t => t.user_id === userId);
    }
    return sorted;
}
