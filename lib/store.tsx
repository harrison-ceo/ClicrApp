"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Business, Venue, Area, Clicr, CountEvent, User, IDScanEvent, BanRecord, BannedPerson, PatronBan, BanEnforcementEvent, BanAuditLog, Device, CapacityOverride, VenueAuditLog } from './types';
import { createClient } from '@/utils/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { apiClient } from '@/lib/api/client';

const INITIAL_USER: User = {
    id: 'usr_owner',
    name: 'Harrison Owner',
    email: 'owner@clicr.com',
    role: 'OWNER',
    assigned_venue_ids: [],
    assigned_area_ids: [],
    assigned_clicr_ids: [],
};

export type AppState = {
    business: Business | null;
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
    bans: BanRecord[];

    // Patron Banning System
    patrons: BannedPerson[];
    patronBans: PatronBan[];
    banAuditLogs: BanAuditLog[];
    banEnforcementEvents: BanEnforcementEvent[];

    isLoading: boolean;
    lastError: string | null; // GLOBAL ERROR STATE

    // Debug / Instrumentation
    debug: {
        realtimeStatus: string;
        lastEvents: unknown[];
        lastWrites: unknown[];
    };
};

// Helper for error logging (uses axios apiClient → Nest when NEXT_PUBLIC_API_URL is set)
const logErrorToUsage = async (userId: string | undefined, message: string, context: string, payload?: any) => {
    try {
        await apiClient.post('/api/log-error', { message, context, payload }, {
            headers: userId ? { 'x-user-id': userId } : {}
        });
    } catch (e) {
        console.error("Failed to log error to backend", e);
    }
};

type AppContextType = AppState & {
    setLastError: (msg: string | null) => void;
    recordEvent: (event: Omit<CountEvent, 'id' | 'timestamp' | 'user_id' | 'business_id'>) => Promise<void>;
    recordScan: (scan: Omit<IDScanEvent, 'id' | 'timestamp'>) => Promise<void>;
    // ... other methods ...
    resetCounts: (venueId?: string, areaId?: string) => void;
    addUser: (user: User) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    removeUser: (userId: string) => Promise<void>;

    // Venue Management
    updateBusiness: (updates: Partial<Business>) => Promise<void>;
    addVenue: (venue: Venue) => Promise<void>;
    updateVenue: (venue: Venue) => Promise<void>;
    addArea: (area: Area) => Promise<void>;
    updateArea: (area: Area) => Promise<boolean>;

    // Devices
    addClicr: (clicr: Clicr) => Promise<{ success: boolean; error?: string }>;
    updateClicr: (clicr: Clicr) => Promise<void>;
    deleteClicr: (clicrId: string) => Promise<{ success: boolean; error?: string }>;
    addDevice: (device: Device) => Promise<void>;
    updateDevice: (device: Device) => Promise<void>;
    deleteDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;

    // Overrides & Logs
    addCapacityOverride: (override: CapacityOverride) => Promise<void>;
    addVenueAuditLog: (log: VenueAuditLog) => Promise<void>;

    // Bans
    addBan: (ban: BanRecord) => Promise<void>;
    revokeBan: (banId: string, revokedByUserId: string, reason?: string) => Promise<void>;
    createPatronBan: (person: BannedPerson, ban: PatronBan, log: BanAuditLog) => Promise<void>;
    updatePatronBan: (ban: PatronBan, log: BanAuditLog) => Promise<void>;
    recordBanEnforcement: (event: BanEnforcementEvent) => Promise<void>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AppState>({
        business: null,
        venues: [],
        areas: [],
        clicrs: [],
        devices: [],
        capacityOverrides: [],
        venueAuditLogs: [],
        events: [],
        scanEvents: [],
        currentUser: INITIAL_USER,
        users: [],
        bans: [],

        patrons: [],
        patronBans: [],
        banAuditLogs: [],
        banEnforcementEvents: [],

        isLoading: true,
        lastError: null,
        debug: {
            realtimeStatus: 'CONNECTING',
            lastEvents: [],
            lastWrites: []
        }
    });

    const isResettingRef = useRef(false);

    const refreshState = async () => {
        if (isResettingRef.current || isWritingRef.current) {
            console.log("Skipping poll due to pending operation");
            return;
        }

        try {
            const { data } = await apiClient.get('/api/sync', { headers: { 'Cache-Control': 'no-store' } });

            // Avoid overwriting optimistic state if a write started while we were fetching
            if (isWritingRef.current) {
                console.log("Skipping sync update due to active write (Pre-setState)");
                return;
            }

            setState(prev => ({
                ...prev,
                ...data,
                venues: data.venues || [],
                areas: data.areas || [],
                clicrs: data.clicrs || [],
                events: data.events || [],
                scanEvents: data.scanEvents || [],
                isLoading: false
            }));
        } catch (error) {
            console.error("Failed to sync state", error);
            logErrorToUsage(state.currentUser?.id, (error as Error).message, 'refreshState');
        }
    };

    // Initial load, polling, AND Realtime Subscription
    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, 2000); // Keep polling as backup/sync mechanism

        // Re-sync on tab focus
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[Store] Tab visible, refreshing state...');
                refreshState();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // REALTIME SUBSCRIPTION
    useEffect(() => {
        const supabase = createClient();
        let channel: RealtimeChannel | null = null;
        const bizId = state.business?.id;

        if (bizId) {
            console.log(`[Realtime] Subscribing to business: ${bizId}`);
            setState(prev => ({ ...prev, debug: { ...prev.debug, realtimeStatus: 'CONNECTING' } }));

            channel = supabase.channel(`occupancy_strict_${bizId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'occupancy_snapshots',
                        filter: `business_id=eq.${bizId}` // Strict Filter by Tenant
                    },
                    (payload) => {
                        console.log('[Realtime] Snapshot Update:', payload);

                        // Instrumentation
                        setState(prev => ({
                            ...prev,
                            debug: {
                                ...prev.debug,
                                lastEvents: [payload, ...prev.debug.lastEvents].slice(0, 5)
                            }
                        }));

                        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                            const newSnap = payload.new as { area_id: string, current_occupancy: number };
                            setState(prev => ({
                                ...prev,
                                areas: prev.areas.map(a => {
                                    if (a.id === newSnap.area_id) {
                                        console.log(`[Realtime] Updating Area ${a.name} (${a.id}) to ${newSnap.current_occupancy}`);
                                        return {
                                            ...a,
                                            current_occupancy: newSnap.current_occupancy
                                        };
                                    }
                                    return a;
                                })
                            }));
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`[Realtime] Status changed: ${status}`);
                    setState(prev => ({ ...prev, debug: { ...prev.debug, realtimeStatus: status } }));

                    if (status === 'SUBSCRIBED') {
                        // RECONNECT SAFETY: Refetch source of truth to ensure no gap
                        refreshState();
                    }
                });
        }

        return () => {
            if (channel) {
                console.log("[Realtime] Unsubscribing...");
                supabase.removeChannel(channel);
            }
        };
    }, [state.business?.id]);

    const authFetch = async (body: Record<string, unknown>) => {
        return apiClient.post('/api/sync', body);
    };

    // Simple lock to prevent polling from overwriting optimistic updates during active writes
    const isWritingRef = useRef(false);

    const recordEvent = async (data: Omit<CountEvent, 'id' | 'timestamp' | 'user_id' | 'business_id'>) => {
        if (!state.business) return;

        isWritingRef.current = true; // Lock polling

        const newEvent: CountEvent = {
            ...data,
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            user_id: state.currentUser.id,
            business_id: state.business.id,
        };

        // Optimistic update
        setState(prev => {
            const updatedClicrs = prev.clicrs.map(c => {
                if (c.id === data.clicr_id) {
                    return { ...c, current_count: c.current_count + data.delta };
                }
                return c;
            });
            return {
                ...prev,
                clicrs: updatedClicrs,
                // OPTIMISTICALLY UPDATE AREA OCCUPANCY
                areas: prev.areas.map(a => {
                    if (a.id === data.area_id) {
                        // Fallback to summing if current_occupancy is missing in cache (migration edge case)
                        const current = a.current_occupancy ?? prev.clicrs.filter(c => c.area_id === a.id).reduce((sum, c) => sum + c.current_count, 0);
                        return {
                            ...a,
                            current_occupancy: Math.max(0, current + data.delta)
                        };
                    }
                    return a;
                }),
                events: [newEvent, ...prev.events] // Prepend locally
            };
        });

        // Send to API
        try {
            const res = await authFetch({ action: 'RECORD_EVENT', payload: newEvent });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            const errData = (error as { response?: { data?: { error?: string } } })?.response?.data ?? {};
            console.error("API/Network Error in recordEvent", errData);
            logErrorToUsage(state.currentUser.id, (error as Error).message, 'recordEvent', { data, errData });
            setState(prev => ({
                ...prev,
                clicrs: prev.clicrs.map(c => c.id === data.clicr_id ? { ...c, current_count: c.current_count - data.delta } : c),
                areas: prev.areas.map(a => a.id === data.area_id ? { ...a, current_occupancy: Math.max(0, (a.current_occupancy || 0) - data.delta) } : a)
            }));
        } finally {
            // Delay unlocking to allow server consistency to settle
            setTimeout(() => {
                isWritingRef.current = false;
            }, 500);
        }
    };

    const recordScan = async (data: Omit<IDScanEvent, 'id' | 'timestamp'>) => {
        isWritingRef.current = true;

        const newScan: IDScanEvent = {
            ...data,
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
        };

        // Optimistic
        setState(prev => ({
            ...prev,
            scanEvents: [newScan, ...prev.scanEvents]
        }));

        try {
            const res = await authFetch({ action: 'RECORD_SCAN', payload: newScan });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error("Failed to record scan", error);
        } finally {
            setTimeout(() => {
                isWritingRef.current = false;
            }, 500);
        }
    };

    const resetCounts = async (venueId?: string, areaId?: string) => {
        // LOCK polling to prevent race conditions
        isResettingRef.current = true;

        // Optimistic update
        const optimisticState = {
            ...state,
            clicrs: state.clicrs.map(c => {
                // If areaId provided, match area. If venueId provided, match venue (via area lookup if needed).
                // Or simply: if we are viewing an Area, we likely passed areaId.
                if (areaId && c.area_id === areaId) return { ...c, current_count: 0 };
                if (venueId && !areaId) {
                    // Check if clicr belongs to venue. Since Clicr -> Area -> Venue, we need Area map.
                    const area = state.areas.find(a => a.id === c.area_id);
                    if (area && area.venue_id === venueId) return { ...c, current_count: 0 };
                }
                // If global reset (legacy)
                if (!venueId && !areaId) return { ...c, current_count: 0 };

                return c;
            }),
            areas: state.areas.map(a => {
                if (areaId && a.id === areaId) return { ...a, current_occupancy: 0 };
                if (venueId && a.venue_id === venueId) return { ...a, current_occupancy: 0 };
                if (!venueId && !areaId) return { ...a, current_occupancy: 0 }; // Global
                return a;
            })
        };
        setState(optimisticState);

        try {
            const res = await apiClient.post('/api/sync', { action: 'RESET_COUNTS', venue_id: venueId, area_id: areaId });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error("Failed to reset counts", error);
        } finally {
            // UNLOCK polling
            isResettingRef.current = false;
            // Force immediate fresh poll
            refreshState();
        }
    };

    const addUser = async (user: User) => {
        // Optimistic
        setState(prev => ({
            ...prev,
            users: [...prev.users, user]
        }));

        try {
            const res = await apiClient.post('/api/sync', { action: 'ADD_USER', payload: user });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error("Failed to add user", error);
        }
    };

    const updateUser = async (user: User) => {
        setState(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === user.id ? user : u)
        }));

        try {
            const res = await apiClient.post('/api/sync', { action: 'UPDATE_USER', payload: user });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to update user", error); }
    };

    const removeUser = async (userId: string) => {
        setState(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== userId)
        }));

        try {
            const res = await apiClient.post('/api/sync', { action: 'REMOVE_USER', payload: { id: userId } });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to remove user", error); }
    };

    // --- VENUE MANAGEMENT ---

    const addVenue = async (venue: Venue) => {
        setState(prev => ({ ...prev, venues: [...prev.venues, venue] }));
        try {
            const res = await authFetch({ action: 'ADD_VENUE', payload: venue });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to add venue", error); }
    };

    const updateVenue = async (venue: Venue) => {
        setState(prev => ({ ...prev, venues: prev.venues.map(v => v.id === venue.id ? venue : v) }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'UPDATE_VENUE', payload: venue });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to update venue", error); }
    };

    const addArea = async (area: Area) => {
        setState(prev => ({ ...prev, areas: [...prev.areas, area] }));
        try {
            const res = await authFetch({ action: 'ADD_AREA', payload: area });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to add area", error); }
    };

    const updateArea = async (area: Area) => {
        // Optimistic
        const originalArea = state.areas.find(a => a.id === area.id);
        setState(prev => ({ ...prev, areas: prev.areas.map(a => a.id === area.id ? area : a) }));

        try {
            const res = await apiClient.post('/api/sync', { action: 'UPDATE_AREA', payload: area });
            setState(prev => ({ ...prev, ...res.data }));
            return true;
        } catch (error) {
            console.error("Failed to update area", error);
            if (originalArea) setState(prev => ({ ...prev, areas: prev.areas.map(a => a.id === area.id ? originalArea : a) }));
            return false;
        }
    };

    // --- DEVICES ---

    const deleteClicr = async (clicrId: string): Promise<{ success: boolean, error?: string }> => {
        // Optimistic - remove from list
        const originalClicr = state.clicrs.find(c => c.id === clicrId);
        setState(prev => ({
            ...prev,
            clicrs: prev.clicrs.filter(c => c.id !== clicrId)
        }));

        try {
            const res = await authFetch({ action: 'DELETE_CLICR', payload: { id: clicrId } });
            setState(prev => ({ ...prev, ...res.data }));
            return { success: true };
        } catch (e) {
            const errData = (e as { response?: { data?: { error?: string }; statusText?: string } })?.response?.data ?? {};
            console.error("Delete Clicr Failed", errData);
            setLastError(`Delete Failed: ${errData.error ?? (e as Error).message}`);
            logErrorToUsage(state.currentUser.id, (e as Error).message, 'deleteClicr', { clicrId });
            if (originalClicr) setState(prev => ({ ...prev, clicrs: [...prev.clicrs, originalClicr] }));
            return { success: false, error: errData.error ?? (e as Error).message };
        }
    };

    const addClicr = async (clicr: Clicr): Promise<{ success: boolean, error?: string }> => {
        // Optimistic Update
        const tempId = clicr.id;
        setState(prev => ({ ...prev, clicrs: [...prev.clicrs, clicr] }));

        try {
            const res = await authFetch({ action: 'ADD_CLICR', payload: clicr });
            const updatedDB = res.data as { clicrs?: Clicr[] };
            const exists = updatedDB.clicrs?.find((c: Clicr) => c.id === clicr.id);
            if (!exists) {
                updatedDB.clicrs = [...(updatedDB.clicrs || []), clicr];
            }
            setState(prev => ({ ...prev, ...res.data }));
            return { success: true };
        } catch (error) {
            const errData = (error as { response?: { data?: { error?: string } } })?.response?.data ?? {};
            console.error("Failed to add clicr", errData);
            setState(prev => ({ ...prev, clicrs: prev.clicrs.filter(c => c.id !== tempId) }));
            return { success: false, error: errData.error ?? (error as Error).message };
        }
    };

    const updateClicr = async (clicr: Clicr) => {
        setState(prev => ({ ...prev, clicrs: prev.clicrs.map(c => c.id === clicr.id ? clicr : c) }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'UPDATE_CLICR', payload: clicr });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to update clicr", error); }
    };

    const addDevice = async (device: Device) => {
        setState(prev => ({ ...prev, devices: [...prev.devices, device] }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'ADD_DEVICE', payload: device });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to add device", error); }
    };

    const updateDevice = async (device: Device) => {
        setState(prev => ({ ...prev, devices: prev.devices.map(d => d.id === device.id ? device : d) }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'UPDATE_DEVICE', payload: device });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to update device", error); }
    };

    const deleteDevice = async (deviceId: string) => {
        // Optimistic
        const originalDevice = state.devices.find(d => d.id === deviceId);
        setState(prev => ({ ...prev, devices: prev.devices.filter(d => d.id !== deviceId) }));

        try {
            const res = await authFetch({ action: 'DELETE_DEVICE', payload: { id: deviceId } });
            setState(prev => ({ ...prev, ...res.data }));
            return { success: true };
        } catch (error) {
            const errData = (error as { response?: { data?: { error?: string } } })?.response?.data ?? {};
            console.error("Delete Device Failed", errData);
            setLastError(`Delete Device Failed: ${errData.error ?? (error as Error).message}`);
            if (originalDevice) setState(prev => ({ ...prev, devices: [...prev.devices, originalDevice] }));
            return { success: false, error: errData.error ?? (error as Error).message };
        }
    };

    // --- OVERRIDES & LOGS ---

    const addCapacityOverride = async (override: CapacityOverride) => {
        setState(prev => ({ ...prev, capacityOverrides: [...prev.capacityOverrides, override] }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'ADD_CAPACITY_OVERRIDE', payload: override });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to add override", error); }
    };

    const addVenueAuditLog = async (log: VenueAuditLog) => {
        setState(prev => ({ ...prev, venueAuditLogs: [...prev.venueAuditLogs, log] }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'ADD_VENUE_AUDIT_LOG', payload: log });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to add audit log", error); }
    };

    // --- BANS ---

    const addBan = async (ban: BanRecord) => {
        setState(prev => ({
            ...prev,
            bans: [...(prev.bans || []), ban]
        }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'CREATE_BAN', payload: ban });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to add ban", error); }
    };

    const revokeBan = async (banId: string, revokedByUserId: string, reason?: string) => {
        setState(prev => ({
            ...prev,
            bans: (prev.bans || []).map(b => b.id === banId ? { ...b, status: 'REVOKED', revoked_by_user_id: revokedByUserId, revoked_at: Date.now(), revoked_reason: reason } : b)
        }));
        try {
            const res = await apiClient.post('/api/sync', { action: 'REVOKE_BAN', payload: { banId, revokedByUserId, reason } });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to revoke ban", error); }
    };

    const createPatronBan = async (person: BannedPerson, ban: PatronBan, log: BanAuditLog) => {
        // Optimistic UI update
        setState(prev => ({
            ...prev,
            patrons: [...prev.patrons.filter(p => p.id !== person.id), person], // Update or push
            patronBans: [...prev.patronBans, ban],
            banAuditLogs: [...prev.banAuditLogs, log]
        }));

        try {
            const res = await apiClient.post('/api/sync', { action: 'CREATE_PATRON_BAN', payload: { person, ban, log } });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error("Failed to create patron ban", error);
        }
    };

    const updatePatronBan = async (ban: PatronBan, log: BanAuditLog) => {
        // Optimistic UI update
        setState(prev => ({
            ...prev,
            patronBans: prev.patronBans.map(b => b.id === ban.id ? ban : b),
            banAuditLogs: [...prev.banAuditLogs, log]
        }));

        try {
            const res = await apiClient.post('/api/sync', { action: 'UPDATE_PATRON_BAN', payload: { ban, log } });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error("Failed to update patron ban", error);
        }
    };

    const recordBanEnforcement = async (event: BanEnforcementEvent) => {
        // Optimistic UI update
        setState(prev => ({
            ...prev,
            banEnforcementEvents: [event, ...prev.banEnforcementEvents]
        }));

        try {
            await apiClient.post('/api/sync', { action: 'RECORD_BAN_ENFORCEMENT', payload: event });
        } catch (error) {
            console.error("Failed to record ban enforcement", error);
        }
    };

    const updateBusiness = async (updates: Partial<Business>) => {
        // Optimistic
        if (state.business) {
            setState(prev => ({
                ...prev,
                business: { ...prev.business!, ...updates }
            }));
        }

        try {
            const res = await authFetch({ action: 'UPDATE_BUSINESS', payload: updates });
            setState(prev => ({ ...prev, ...res.data }));
        } catch (error) { console.error("Failed to update business", error); }
    };

    const setLastError = (msg: string | null) => {
        setState(prev => ({ ...prev, lastError: msg }));
    }

    return (
        <AppContext.Provider value={{ ...state, setLastError, recordEvent, recordScan, resetCounts, addUser, updateUser, removeUser, updateBusiness, addClicr, updateClicr, deleteClicr, addVenue, updateVenue, addArea, updateArea, addDevice, updateDevice, deleteDevice, addCapacityOverride, addVenueAuditLog, addBan, revokeBan, createPatronBan, updatePatronBan, recordBanEnforcement }}>
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
