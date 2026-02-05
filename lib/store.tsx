"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Business, Venue, Area, Clicr, CountEvent, User, IDScanEvent, BanRecord, BannedPerson, PatronBan, BanEnforcementEvent, BanAuditLog, Device, CapacityOverride, VenueAuditLog, DeviceLayout, TurnaroundEvent } from './types';
import { createClient } from '@/utils/supabase/client';
import { RealtimeManager } from './realtime-manager';
import { MUTATIONS } from './core/mutations';
import { METRICS, TrafficTotals } from './core/metrics';
import { getTodayWindow } from './core/time';

// --- TYPES ---

export type AppState = {
    business: Business | null;
    venues: Venue[];
    areas: Area[];
    clicrs: Clicr[]; // Legacy mapping for UI compatibility
    devices: Device[];
    capacityOverrides: CapacityOverride[];
    venueAuditLogs: VenueAuditLog[];
    events: CountEvent[];
    scanEvents: IDScanEvent[];
    currentUser: User | null;
    users: User[];

    // Layouts & Config
    deviceLayouts: DeviceLayout[];
    turnarounds: TurnaroundEvent[];

    // Core Data
    bans: BanRecord[];
    patrons: BannedPerson[];
    patronBans: PatronBan[];

    // Traffic Stats (Business Level Source of Truth)
    traffic: TrafficTotals;

    // Scoped Traffic Stats (For Clicr Screens)
    areaTraffic: Record<string, TrafficTotals>;

    isLoading: boolean;
    lastError: string | null;

    // Debug / Instrumentation
    debug: {
        realtimeStatus: string;
        lastEvents: unknown[];
        lastWrites: unknown[];
        lastSnapshots: unknown[];
    };
};

type AppContextType = AppState & {
    setLastError: (msg: string | null) => void;
    recordEvent: (event: Omit<CountEvent, 'id' | 'timestamp' | 'user_id' | 'business_id'>) => Promise<void>;
    recordScan: (scan: Omit<IDScanEvent, 'id' | 'timestamp' | 'business_id'>, autoAdd?: boolean) => Promise<void>;
    resetCounts: (scope: 'AREA' | 'VENUE' | 'BUSINESS', targetId: string) => Promise<void>;
    refreshTrafficStats: (venueId?: string, areaId?: string) => Promise<void>;

    // Device Management
    deleteClicr: (clicrId: string) => Promise<{ success: boolean; error?: string }>;
    updateClicr: (clicr: Clicr) => Promise<void>;

    // Simple pass-throughs or placeholders for now
    updateBusiness: (updates: Partial<Business>) => Promise<void>;
    addUser: (user: User) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    removeUser: (userId: string) => Promise<void>;
    addVenue: (venue: Venue) => Promise<void>;
    updateVenue: (venue: Venue) => Promise<void>;
    addArea: (area: Area) => Promise<void>;
    updateArea: (area: Area) => Promise<boolean>;
    addClicr: (clicr: Clicr) => Promise<{ success: boolean; error?: string }>;
    addDevice: (device: Device) => Promise<void>;
    updateDevice: (device: Device) => Promise<void>;
    deleteDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
    addCapacityOverride: (override: CapacityOverride) => Promise<void>;
    addVenueAuditLog: (log: VenueAuditLog) => Promise<void>;
    addBan: (ban: BanRecord) => Promise<void>;
    revokeBan: (banId: string, revokedByUserId: string, reason?: string) => Promise<void>;
    createPatronBan: (person: BannedPerson, ban: PatronBan, log: BanAuditLog) => Promise<void>;
    updatePatronBan: (ban: PatronBan, log: BanAuditLog) => Promise<void>;
    recordBanEnforcement: (event: BanEnforcementEvent) => Promise<void>;

    // P0 New Features
    upsertDeviceLayout: (layoutMode: 'single' | 'dual', primaryId: string, secondaryId: string | null) => Promise<void>;
    renameDevice: (deviceId: string, name: string) => Promise<void>;
    recordTurnaround: (venueId: string, areaId: string, deviceId: string | undefined, count?: number) => Promise<void>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

// --- INITIAL STATE ---
const INITIAL_STATE: AppState = {
    business: null,
    venues: [],
    areas: [],
    clicrs: [],
    devices: [],
    capacityOverrides: [],
    venueAuditLogs: [],
    events: [],
    scanEvents: [],
    deviceLayouts: [],
    turnarounds: [],
    currentUser: null,
    users: [],
    bans: [],
    patrons: [],
    patronBans: [],
    traffic: { total_in: 0, total_out: 0, net_delta: 0, event_count: 0 },
    areaTraffic: {},
    isLoading: true,
    lastError: null,
    debug: { realtimeStatus: 'CONNECTING', lastEvents: [], lastWrites: [], lastSnapshots: [] }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AppState>(INITIAL_STATE);
    const realtimeManager = useRef(new RealtimeManager());
    const supabase = createClient();

    // Helper: Set Last Error
    const setLastError = (msg: string | null) => setState(prev => ({ ...prev, lastError: msg }));

    // --- 1. CORE SYNC LOGIC (SUPABASE ONLY) ---
    const refreshState = useCallback(async () => {
        try {
            // A. Auth Context
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setState(prev => ({ ...prev, isLoading: false, currentUser: null }));
                return;
            }

            // B. Profile & Business Context
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            const businessId = profile?.business_id;

            if (!businessId) {
                console.warn("[Store] No business connected to user.");
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            // C. PARALLEL FETCH (Performance)
            const [
                { data: business },
                { data: venues },
                { data: areas },
                { data: devices },
                { data: snapshots },
                { data: events },
                { data: deviceLayouts },
                { data: turnarounds },
                totals
            ] = await Promise.all([
                supabase.from('businesses').select('*').eq('id', businessId).single(),
                supabase.from('venues').select('*').eq('business_id', businessId).eq('status', 'ACTIVE'),
                supabase.from('areas').select('*').eq('business_id', businessId).eq('is_active', true),
                supabase.from('devices').select('*').eq('business_id', businessId).is('deleted_at', null),
                supabase.from('occupancy_snapshots').select('*').eq('business_id', businessId),
                supabase.from('occupancy_events').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(50),
                supabase.from('device_layouts').select('*').eq('business_id', businessId),
                supabase.from('turnarounds').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(50),
                METRICS.getTotals(businessId, {}) // Global totals
            ]);

            // D. Transform & Merge Data
            const mappedUser: User = {
                id: user.id,
                name: profile?.full_name || user.email || 'User',
                email: user.email || '',
                role: profile?.role || 'USER',
                assigned_venue_ids: [],
                assigned_area_ids: [],
                assigned_clicr_ids: []
            };

            // Map Snapshots to Areas (Client-Side Join)
            const areaWithCounts = (areas || []).map(a => {
                const snap = (snapshots || []).find(s => s.area_id === a.id);
                return {
                    ...a,
                    current_occupancy: snap?.current_occupancy || 0,
                    // Ensure capacity_max matches DB or fallback
                    capacity_max: a.capacity_max || a.default_capacity || 0
                };
            });

            // Map Devices to "Clicrs" (Legacy UI compatibility)
            const mappedClicrs: Clicr[] = (devices || []).map(d => ({
                id: d.id,
                area_id: d.area_id || '',
                name: d.name || 'Device',
                flow_mode: d.direction_mode === 'in_only' ? 'IN_ONLY' : d.direction_mode === 'out_only' ? 'OUT_ONLY' : 'BIDIRECTIONAL',
                current_count: 0, // Not used for display, AREA count is used
                active: true,
                button_config: d.config?.button_config || undefined
            }));

            // E. Update State
            setState(prev => ({
                ...prev,
                isLoading: false,
                currentUser: mappedUser,
                business: business as any,
                venues: (venues || []).map(v => ({
                    ...v,
                    default_capacity_total: v.total_capacity,
                    capacity_max: v.total_capacity
                })) as any[],
                areas: areaWithCounts as any[],
                devices: (devices || []) as any[],
                deviceLayouts: (deviceLayouts || []) as any[],
                turnarounds: (turnarounds || []) as any[],
                clicrs: mappedClicrs,
                events: (events || []) as any[],
                traffic: totals, // Full Sync of Totals
                areaTraffic: prev.areaTraffic // Preserve scoped cache
            }));

        } catch (error) {
            console.error("[Store] Sync Failed", error);
            setLastError("Failed to sync data.");
        }
    }, [supabase]);

    // Initial Load & Polling Fallback
    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, 30000);
        return () => clearInterval(interval);
    }, [refreshState]);


    // --- 2. REALTIME SUBSCRIPTION ---
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const debouncedRefreshTotals = useCallback((venueId?: string, areaId?: string) => {
        const key = venueId && areaId ? `area:${state.business?.id}:${venueId}:${areaId}` : 'global';

        if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

        debounceTimers.current[key] = setTimeout(() => {
            refreshTrafficStats(venueId, areaId);
            delete debounceTimers.current[key];
        }, 600);
    }, [state.business?.id]);

    useEffect(() => {
        const businessId = state.business?.id;
        if (businessId) {
            realtimeManager.current.subscribe(businessId, {
                onStatusChange: (status) => setState(prev => ({ ...prev, debug: { ...prev.debug, realtimeStatus: status } })),

                onSnapshot: (payload) => {
                    const newSnap = payload.new;
                    // Precise State Update
                    setState(prev => ({
                        ...prev,
                        areas: prev.areas.map(a =>
                            a.id === newSnap.area_id
                                ? { ...a, current_occupancy: newSnap.current_occupancy }
                                : a
                        ),
                        debug: {
                            ...prev.debug,
                            lastSnapshots: [newSnap, ...prev.debug.lastSnapshots].slice(0, 10)
                        }
                    }));
                },

                onEvent: (payload) => {
                    // INSTANT LOCAL INCREMENT (For other devices)
                    const e = payload.new;
                    const d = e.delta;

                    setState(prev => {
                        // Avoid double counting if we just optimistically added it
                        // Simple heuristic: if we have it in our recent events list (by ID), skip
                        // But for now, we rely on optimistic updates to have pushed it to state already? 
                        // Actually, optimistic updates in `recordEvent` don't add to `events` array immediately usually, or do they?
                        // Let's check recordEvent... it just updates occupancy and traffic stats.
                        // So if we receive our own event back, we might double count totals.
                        // Ideally checking `e.user_id === state.currentUser.id` ignores it?
                        // BUT `recordEvent` does optimistic traffic update.

                        // Rule: If `e.user_id` matches current user, we ALREADY applied it in recordEvent.
                        // So only apply if from SOMEONE ELSE.
                        const isMine = e.user_id === prev.currentUser?.id;
                        if (isMine) return prev;

                        return {
                            ...prev,
                            // events: [e, ...prev.events].slice(0, 50), // We can add to log
                            traffic: {
                                ...prev.traffic,
                                total_in: d > 0 ? prev.traffic.total_in + d : prev.traffic.total_in,
                                total_out: d < 0 ? prev.traffic.total_out + Math.abs(d) : prev.traffic.total_out,
                                net_delta: prev.traffic.net_delta + d,
                                event_count: prev.traffic.event_count + 1
                            },
                            // Update Area-Scoped Traffic
                            areaTraffic: {
                                ...prev.areaTraffic,
                                [`area:${e.business_id}:${e.venue_id}:${e.area_id}`]: {
                                    total_in: (prev.areaTraffic[`area:${e.business_id}:${e.venue_id}:${e.area_id}`]?.total_in || 0) + (d > 0 ? d : 0),
                                    total_out: (prev.areaTraffic[`area:${e.business_id}:${e.venue_id}:${e.area_id}`]?.total_out || 0) + (d < 0 ? Math.abs(d) : 0),
                                    net_delta: (prev.areaTraffic[`area:${e.business_id}:${e.venue_id}:${e.area_id}`]?.net_delta || 0) + d,
                                    event_count: (prev.areaTraffic[`area:${e.business_id}:${e.venue_id}:${e.area_id}`]?.event_count || 0) + 1
                                }
                            },
                            debug: { ...prev.debug, lastEvents: [e, ...prev.debug.lastEvents].slice(0, 10) }
                        };
                    });

                    // Always reconcile eventually to be safe
                    // Reconcile Global
                    debouncedRefreshTotals();
                    // Reconcile Area Scope
                    debouncedRefreshTotals(e.venue_id, e.area_id);
                }
            });
        }
        return () => realtimeManager.current.unsubscribe();
    }, [state.business?.id, debouncedRefreshTotals]); // Added debouncedRefreshTotals dependency


    // --- 3. ACTIONS (MUTATIONS) ---

    // A. Count (+/-)
    const recordEvent = async (event: Omit<CountEvent, 'id' | 'timestamp' | 'user_id' | 'business_id'>) => {
        const bizId = state.business?.id;
        const userId = state.currentUser?.id;
        if (!bizId || !userId) return;

        // Optimistic UI Update
        const d = event.delta;
        setState(prev => ({
            ...prev,
            areas: prev.areas.map(a => a.id === event.area_id ? { ...a, current_occupancy: Math.max(0, (a.current_occupancy || 0) + d) } : a),
            traffic: {
                ...prev.traffic,
                total_in: d > 0 ? prev.traffic.total_in + d : prev.traffic.total_in,
                total_out: d < 0 ? prev.traffic.total_out + Math.abs(d) : prev.traffic.total_out,
                net_delta: prev.traffic.net_delta + d
            },
            areaTraffic: {
                ...prev.areaTraffic,
                [`area:${bizId}:${event.venue_id}:${event.area_id}`]: {
                    total_in: (prev.areaTraffic[`area:${bizId}:${event.venue_id}:${event.area_id}`]?.total_in || 0) + (d > 0 ? d : 0),
                    total_out: (prev.areaTraffic[`area:${bizId}:${event.venue_id}:${event.area_id}`]?.total_out || 0) + (d < 0 ? Math.abs(d) : 0),
                    net_delta: (prev.areaTraffic[`area:${bizId}:${event.venue_id}:${event.area_id}`]?.net_delta || 0) + d,
                    event_count: (prev.areaTraffic[`area:${bizId}:${event.venue_id}:${event.area_id}`]?.event_count || 0) + 1
                }
            }
        }));

        try {
            await MUTATIONS.applyDelta(
                { businessId: bizId, venueId: event.venue_id, areaId: event.area_id, userId: userId },
                event.delta,
                'tap',
                event.clicr_id
            );

            // Reconcile eventually
            debouncedRefreshTotals();
            debouncedRefreshTotals(event.venue_id, event.area_id);
        } catch (e) {
            console.error("Tap failed", e);
            setLastError("Tap failed to save. Retrying...");
            refreshState();
        }
    };

    // B. Reset
    const resetCounts = async (scope: 'AREA' | 'VENUE' | 'BUSINESS', targetId: string) => {
        const bizId = state.business?.id;
        const userId = state.currentUser?.id;
        if (!bizId || !userId) return;

        // Optimistic Clear
        setState(prev => ({
            ...prev,
            areas: prev.areas.map(a => {
                if (scope === 'BUSINESS') return { ...a, current_occupancy: 0 };
                if (scope === 'VENUE' && a.venue_id === targetId) return { ...a, current_occupancy: 0 };
                if (scope === 'AREA' && a.id === targetId) return { ...a, current_occupancy: 0 };
                return a;
            }),
            traffic: { total_in: 0, total_out: 0, net_delta: 0, event_count: 0 } // Aggressive clear
        }));

        try {
            await MUTATIONS.resetCounts({ businessId: bizId, userId }, scope, targetId);
            refreshState();
        } catch (e) {
            console.error("Reset failed", e);
            setLastError("Reset failed.");
            refreshState();
        }
    };

    // C. Scan
    const recordScan = async (scan: Omit<IDScanEvent, 'id' | 'timestamp' | 'business_id'>, autoAdd = false) => {
        const bizId = state.business?.id;
        const userId = state.currentUser?.id;
        if (!bizId || !userId) return;

        try {
            const savedScan = await MUTATIONS.recordScan(
                { businessId: bizId, userId, venueId: scan.venue_id, areaId: undefined, deviceId: undefined },
                scan,
                autoAdd
            );
            setState(prev => ({
                ...prev,
                scanEvents: [savedScan, ...prev.scanEvents].slice(0, 50)
            }));
            if (autoAdd) refreshTrafficStats();
        } catch (e) {
            console.error("Scan failed", e);
            setLastError("Failed to record scan.");
        }
    };

    // D. Delete Clicr
    const deleteClicr = async (clicrId: string) => {
        const bizId = state.business?.id;
        const userId = state.currentUser?.id;
        if (!bizId || !userId) return { success: false, error: 'No Context' };

        setState(prev => ({
            ...prev,
            clicrs: prev.clicrs.filter(c => c.id !== clicrId),
            devices: prev.devices.filter(d => d.id !== clicrId)
        }));

        try {
            await MUTATIONS.deleteDevice({ businessId: bizId, userId }, clicrId);
            return { success: true };
        } catch (e) {
            console.error("Delete failed", e);
            setLastError("Failed to delete device.");
            refreshState();
            return { success: false, error: (e as Error).message };
        }
    };

    // Helper: Refresh Stats
    // Helper: Refresh Stats
    const refreshTrafficStats = async (venueId?: string, areaId?: string) => {
        if (!state.business?.id) return;
        const stats = await METRICS.getTotals(state.business.id, { venueId, areaId });

        setState(prev => {
            if (venueId && areaId) {
                // Scope Update
                return {
                    ...prev,
                    areaTraffic: {
                        ...prev.areaTraffic,
                        [`area:${state.business!.id}:${venueId}:${areaId}`]: stats
                    }
                };
            } else {
                // Global Update
                return { ...prev, traffic: stats };
            }
        });
    };

    // --- 4. CRUD OPERATIONS ---

    const updateBusiness = async (updates: Partial<Business>) => {
        if (!state.business?.id) return;
        const { error } = await supabase.from('businesses').update(updates).eq('id', state.business.id);
        if (error) setLastError(error.message);
        else refreshState();
    };

    const addVenue = async (venue: Venue) => {
        if (!state.business?.id) return;

        // Map UI field to DB field
        const dbPayload = {
            ...venue,
            business_id: state.business.id,
            total_capacity: venue.default_capacity_total,
            default_capacity_total: undefined // Remove UI field
        };

        const { error } = await supabase.from('venues').insert(dbPayload);
        if (error) setLastError(error.message);
        else refreshState();
    };

    const updateVenue = async (venue: Venue) => {
        const dbPayload = {
            ...venue,
            total_capacity: venue.default_capacity_total, // Map
            default_capacity_total: undefined
        };

        const { error } = await supabase.from('venues').update(dbPayload).eq('id', venue.id);
        if (error) setLastError(error.message);
        else refreshState();
    };

    const addArea = async (area: Area) => {
        if (!state.business?.id) return;
        const { error } = await supabase.from('areas').insert({
            ...area,
            business_id: state.business.id,
            // Ensure capacity maps correctly if UI uses different name
            // DB has capacity_max. UI uses default_capacity.
            capacity_max: area.default_capacity || 0
        });
        if (error) setLastError(error.message);
        else refreshState();
    };

    const updateArea = async (area: Area) => {
        const { error } = await supabase.from('areas').update({
            name: area.name,
            area_type: area.area_type,
            capacity_max: area.default_capacity,
            counting_mode: area.counting_mode,
            is_active: area.is_active
        }).eq('id', area.id);

        if (error) {
            setLastError(error.message);
            return false;
        } else {
            refreshState();
            return true;
        }
    };

    const updateClicr = async (clicr: Clicr) => {
        // Sync name changes to Device & Config
        const { error } = await supabase.from('devices').update({
            name: clicr.name,
            config: { button_config: clicr.button_config }
        }).eq('id', clicr.id);
        if (error) setLastError(error.message);
        else refreshState();
    };

    // P0 FEATURE IMPLEMENTATIONS
    const upsertDeviceLayout = async (layoutMode: 'single' | 'dual', primaryId: string, secondaryId: string | null) => {
        if (!state.business?.id) return;
        const { error } = await supabase.rpc('upsert_device_layout', {
            p_business_id: state.business.id,
            p_layout_mode: layoutMode,
            p_primary_device_id: primaryId,
            p_secondary_device_id: secondaryId
        });
        if (error) setLastError(error.message);
        else refreshState();
    };

    const renameDevice = async (deviceId: string, name: string) => {
        if (!state.business?.id) return;
        const { error } = await supabase.rpc('update_device_name', {
            p_business_id: state.business.id,
            p_device_id: deviceId,
            p_name: name
        });
        if (error) setLastError(error.message);
        else refreshState();
    };

    const recordTurnaround = async (venueId: string, areaId: string, deviceId: string | undefined, count: number = 1) => {
        if (!state.business?.id) return;

        const { error } = await supabase.rpc('add_turnaround', {
            p_business_id: state.business.id,
            p_venue_id: venueId,
            p_area_id: areaId,
            p_device_id: deviceId,
            p_count: count
        });

        if (error) {
            setLastError(error.message);
        } else {
            refreshState();
            refreshTrafficStats(venueId, areaId);
        }
    };

    // Device / Clicr Management (Unified)
    const addDevice = async (device: Device) => {
        const { error } = await supabase.from('devices').insert(device);
        if (error) {
            console.error("Add Device Failed", error);
            setLastError(error.message);
        } else {
            await refreshState();
        }
    };

    const addClicr = async (clicr: Clicr) => {
        const bizId = state.business?.id;
        if (!bizId) return { success: false, error: 'No Business Context' };

        // Map Clicr -> Device
        const flowMap: Record<string, string> = {
            'IN_ONLY': 'in_only',
            'OUT_ONLY': 'out_only',
            'BIDIRECTIONAL': 'bidirectional'
        };

        const newDevice = {
            id: clicr.id, // Use ID generated by UI
            business_id: bizId,
            venue_id: state.areas.find(a => a.id === clicr.area_id)?.venue_id,
            area_id: clicr.area_id,
            device_type: 'COUNTER' as const,
            name: clicr.name,
            direction_mode: (flowMap[clicr.flow_mode] || 'bidirectional') as 'in_only' | 'out_only' | 'bidirectional',
            status: 'ACTIVE' as const,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('devices').insert(newDevice);

        if (error) {
            console.error("Add Clicr/Device Failed", error);
            setLastError(error.message);
            return { success: false, error: error.message };
        }

        await refreshState(); // Refresh to get the new device in list
        return { success: true };
    };

    const addUser = async (u: any) => { };
    const updateUser = async (u: any) => { };
    const removeUser = async (uid: string) => { };

    // const addDevice = addClicr; // REMOVED ALIAS to fix type error
    const updateDevice = async (d: any) => { };
    const deleteDevice = deleteClicr; // Alias implementation
    const addCapacityOverride = async (o: any) => { };
    const addVenueAuditLog = async (l: any) => { };
    const addBan = async (b: any) => { };
    const revokeBan = async (id: string, uid: string, r?: string) => { };
    const createPatronBan = async (p: any, b: any, l: any) => { };
    const updatePatronBan = async (b: any, l: any) => { };
    const recordBanEnforcement = async (e: any) => { };

    return (
        <AppContext.Provider value={{
            ...state,
            setLastError,
            recordEvent,
            recordScan,
            resetCounts,
            refreshTrafficStats,
            deleteClicr,
            updateClicr,
            updateBusiness,
            addUser, updateUser, removeUser,
            addVenue, updateVenue,
            addArea, updateArea,
            addClicr, addDevice, updateDevice, deleteDevice,
            addCapacityOverride, addVenueAuditLog,
            addBan, revokeBan, createPatronBan, updatePatronBan, recordBanEnforcement,
            upsertDeviceLayout, renameDevice, recordTurnaround
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
