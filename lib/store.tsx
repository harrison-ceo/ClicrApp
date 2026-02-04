"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Business, Venue, Area, Clicr, CountEvent, User, IDScanEvent, BanRecord, BannedPerson, PatronBan, BanEnforcementEvent, BanAuditLog, Device, CapacityOverride, VenueAuditLog } from './types';
import { createClient } from '@/utils/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getTrafficTotals, getTodayWindow, TrafficStats } from './metrics-service';
import { RealtimeManager } from './realtime-manager';

const INITIAL_USER: User = {
    id: 'usr_owner',
    name: 'Harrison Owner',
    email: 'owner@clicr.com',
    role: 'OWNER',
    assigned_venue_ids: [],
    assigned_area_ids: [],
    assigned_clicr_ids: [],
};

const INITIAL_TRAFFIC: TrafficStats = {
    total_in: 0,
    total_out: 0,
    net_delta: 0,
    event_count: 0,
    period: getTodayWindow(),
    source: 'init'
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

    // Traffic Stats (Business Level Source of Truth)
    traffic: TrafficStats;

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
        lastSnapshots: unknown[];
    };
};

// Helper for error logging
const logErrorToUsage = async (userId: string | undefined, message: string, context: string, payload?: any) => {
    try {
        await fetch('/api/log-error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(userId ? { 'x-user-id': userId } : {})
            },
            body: JSON.stringify({ message, context, payload })
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
    resetCounts: (scope: 'AREA' | 'VENUE' | 'BUSINESS', targetId: string) => Promise<void>;
    refreshTrafficStats: (venueId?: string, areaId?: string) => Promise<void>;
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

        traffic: INITIAL_TRAFFIC,

        patrons: [],
        patronBans: [],
        banAuditLogs: [],
        banEnforcementEvents: [],

        isLoading: true,
        lastError: null,
        debug: {
            realtimeStatus: 'CONNECTING',
            lastEvents: [],
            lastWrites: [],
            lastSnapshots: []
        }
    });

    const isResettingRef = useRef(false);
    const realtimeManager = useRef(new RealtimeManager());

    // 1. Unified Traffic Refetcher
    const refreshTrafficStats = useCallback(async (venueId?: string, areaId?: string) => {
        const businessId = state.business?.id;
        if (!businessId) return;

        // Fetch Global Business Stats (Metrics Service)
        const globalStats = await getTrafficTotals({ business_id: businessId }, getTodayWindow());

        setState(prev => ({
            ...prev,
            traffic: globalStats
        }));
    }, [state.business?.id]);

    const refreshState = useCallback(async () => {
        if (isResettingRef.current || isWritingRef.current) {
            console.log("Skipping poll due to pending operation");
            return;
        }

        try {
            // Get current Supabase Session
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (user) {
                headers['x-user-id'] = user.id;
                headers['x-user-email'] = user.email || '';
            }

            const res = await fetch('/api/sync', {
                cache: 'no-store',
                headers
            });

            if (res.ok) {
                const data = await res.json();

                // Avoid overwriting optimistic state if a write started while we were fetching
                if (isWritingRef.current) {
                    console.log("Skipping sync update due to active write (Pre-setState)");
                    return;
                }

                setState(prev => ({
                    ...prev,
                    ...data,
                    // Defensive: Ensure arrays are arrays
                    venues: data.venues || [],
                    areas: data.areas || [],
                    clicrs: data.clicrs || [],
                    events: data.events || [],
                    scanEvents: data.scanEvents || [],
                    isLoading: false
                }));
            } else {
                console.warn("Sync failed with status:", res.status);
                setState(prev => ({ ...prev, isLoading: false }));
            }
        } catch (error) {
            console.error("Failed to sync state", error);
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    // Initial load, polling
    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, 5000); // Poll slower

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
    }, [refreshState]);

    // Realtime Manager Hookup
    useEffect(() => {
        const busId = state.business?.id;
        if (busId) {
            realtimeManager.current.subscribe(busId, {
                onStatusChange: (status) => {
                    setState(prev => ({ ...prev, debug: { ...prev.debug, realtimeStatus: status } }));
                    if (status === 'SUBSCRIBED') {
                        refreshState();
                        refreshTrafficStats();
                    }
                },
                onSnapshot: (payload) => {
                    const newSnap = payload.new;
                    setState(prev => ({
                        ...prev,
                        debug: {
                            ...prev.debug,
                            lastSnapshots: [newSnap, ...prev.debug.lastSnapshots].slice(0, 10)
                        },
                        areas: prev.areas.map(a =>
                            a.id === newSnap.area_id
                                ? { ...a, current_occupancy: newSnap.current_occupancy }
                                : a
                        )
                    }));
                },
                onEvent: (payload) => {
                    // 1. Refresh Totals immediately
                    refreshTrafficStats();

                    // 2. Add to local list for debug
                    const newEvent = payload.new;
                    setState(prev => ({
                        ...prev,
                        debug: { ...prev.debug, lastEvents: [newEvent, ...prev.debug.lastEvents].slice(0, 20) },
                        events: [newEvent, ...prev.events].slice(0, 50)
                    }));
                }
            });
        }
        return () => realtimeManager.current.unsubscribe();
    }, [state.business?.id, refreshTrafficStats, refreshState]);

    // Auth Fetch helper
    const authFetch = async (body: Record<string, unknown>) => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (user) {
            headers['x-user-id'] = user.id;
            headers['x-user-email'] = user.email || '';
        }
        return fetch('/api/sync', { method: 'POST', headers, body: JSON.stringify(body) });
    };

    // Simple lock to prevent polling from overwriting optimistic updates during active writes
    const isWritingRef = useRef(false);


    const recordEvent = async (data: Omit<CountEvent, 'id' | 'timestamp' | 'user_id' | 'business_id'>) => {
        if (!state.business) return;

        // Prevent concurrent writes if strict strictness is needed, but for "clicker" speed we often want fire-and-forget.
        // However, requirements say "atomic", "no race conditions".
        isWritingRef.current = true;


        const businessId = state.business?.id;
        const userId = state.currentUser?.id;

        if (!businessId || !userId) {
            console.error("Missing context for recordEvent");
            return;
        }

        // Optimistic Update (UI responsiveness)
        setState(prev => {
            return {
                ...prev,
                clicrs: prev.clicrs.map(c => {
                    if (c.id === data.clicr_id) return { ...c, current_count: c.current_count + data.delta };
                    return c;
                }),
                areas: prev.areas.map(a => {
                    if (a.id === data.area_id) {
                        const current = a.current_occupancy || 0;
                        // Prevent negative optimistic UI
                        return { ...a, current_occupancy: Math.max(0, current + data.delta) };
                    }
                    return a;
                })
            };
        });

        try {
            // Call API Route instead of direct RPC to ensure consistency with Server Logic
            // This restores the "Yesterday" behavior which was working.
            const res = await authFetch({
                action: 'RECORD_EVENT',
                payload: {
                    ...data,
                    business_id: businessId,
                    user_id: userId,
                    flow_type: data.delta > 0 ? 'IN' : 'OUT', // Explicitly derive
                    event_type: 'clicker',
                    clicr_id: data.clicr_id
                }
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.error || 'API Failed');
            }

            const result = await res.json(); // API result might be the whole DBData or success flag.

            // For the API route we have now, it returns updatedData.
            // But we already optimistically updated. 
            // We just need to confirm success.

            // Log Success to Debug
            setState(prev => ({
                ...prev,
                debug: {
                    ...prev.debug,
                    lastWrites: [{ type: 'API_SUCCESS', payload: data }, ...prev.debug.lastWrites].slice(0, 5)
                }
            }));

            // Refresh Traffic Stats instantly
            refreshTrafficStats();
        }

        catch (error) {
            console.error("RPC Failed", error);
            logErrorToUsage(userId, `RPC Error: ${(error as Error).message}`, 'process_occupancy_event', { data });

            // Revert Optimistic Update
            setState(prev => ({
                ...prev,
                clicrs: prev.clicrs.map(c => c.id === data.clicr_id ? { ...c, current_count: c.current_count - data.delta } : c),
                areas: prev.areas.map(a => a.id === data.area_id ? { ...a, current_occupancy: Math.max(0, (a.current_occupancy || 0) - data.delta) } : a),
                debug: {
                    ...prev.debug,
                    lastWrites: [{ type: 'RPC_FAIL', payload: data, error }, ...prev.debug.lastWrites].slice(0, 5)
                }
            }));

            // Ideally notify user visibly
            setLastError("Failed to update count. Please retry.");
        } finally {
            setTimeout(() => { isWritingRef.current = false; }, 100);
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
            const res = await authFetch({ action: 'RECORD_SCAN', payload: newScan }); // Use authFetch
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) {
            console.error("Failed to record scan", error);
        } finally {
            setTimeout(() => {
                isWritingRef.current = false;
            }, 500);
        }
    };





    const resetCounts = async (scope: 'AREA' | 'VENUE' | 'BUSINESS', targetId: string) => {
        const businessId = state.business?.id;
        const userId = state.currentUser?.id;

        if (!businessId) return;

        // Optimistic Update
        setState(prev => ({
            ...prev,
            areas: prev.areas.map(a => {
                if (scope === 'BUSINESS') return { ...a, current_occupancy: 0 };
                if (scope === 'VENUE' && a.venue_id === targetId) return { ...a, current_occupancy: 0 };
                if (scope === 'AREA' && a.id === targetId) return { ...a, current_occupancy: 0 };
                return a;
            })
        }));

        try {
            const res = await fetch('/api/rpc/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: businessId,
                    scope,
                    target_id: targetId,
                    user_id: userId
                })
            });

            if (!res.ok) {
                throw new Error('Reset failed');
            }

            // Force full refresh to ensure snapshots and events align
            await refreshState();
            await refreshTrafficStats();

        } catch (e) {
            console.error("Reset Failed", e);
            // Revert? (Complex to revert reset, just notify user)
            setLastError("Failed to reset counts on server.");
        }
    };


    const addUser = async (user: User) => {
        // Optimistic
        setState(prev => ({
            ...prev,
            users: [...prev.users, user]
        }));

        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ADD_USER', payload: user })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
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
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_USER', payload: user })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to update user", error); }
    };

    const removeUser = async (userId: string) => {
        setState(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== userId)
        }));

        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REMOVE_USER', payload: { id: userId } })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to remove user", error); }
    };

    // --- VENUE MANAGEMENT ---

    const addVenue = async (venue: Venue) => {
        setState(prev => ({ ...prev, venues: [...prev.venues, venue] }));
        try {
            const res = await authFetch({ action: 'ADD_VENUE', payload: venue });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to add venue", error); }
    };

    const updateVenue = async (venue: Venue) => {
        setState(prev => ({ ...prev, venues: prev.venues.map(v => v.id === venue.id ? venue : v) }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_VENUE', payload: venue })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to update venue", error); }
    };

    const addArea = async (area: Area) => {
        setState(prev => ({ ...prev, areas: [...prev.areas, area] }));
        try {
            const res = await authFetch({ action: 'ADD_AREA', payload: area });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to add area", error); }
    };

    const updateArea = async (area: Area) => {
        // Optimistic
        const originalArea = state.areas.find(a => a.id === area.id);
        setState(prev => ({ ...prev, areas: prev.areas.map(a => a.id === area.id ? area : a) }));

        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_AREA', payload: area })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
                return true;
            } else {
                // Revert
                console.error("Update Area Failed API");
                if (originalArea) setState(prev => ({ ...prev, areas: prev.areas.map(a => a.id === area.id ? originalArea : a) }));
                return false;
            }
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
            clicrs: prev.clicrs.filter(c => c.id !== clicrId),
            // Also remove from devices if present (unification)
            devices: prev.devices.filter(d => d.id !== clicrId)
        }));

        try {
            const res = await authFetch({ action: 'DELETE_CLICR', payload: { id: clicrId } });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
                return { success: true };
            } else {
                const errData = await res.json().catch(() => ({ error: 'Unknown JSON parsing error' }));
                console.error("Delete Clicr Failed API", errData);
                setLastError(`Delete Failed: ${errData.error || res.statusText}`);
                logErrorToUsage(state.currentUser.id, `Delete Clicr Failed: ${errData.error}`, 'deleteClicr', { clicrId });

                // Revert
                if (originalClicr) setState(prev => ({ ...prev, clicrs: [...prev.clicrs, originalClicr] }));

                return { success: false, error: errData.error || res.statusText };
            }
        } catch (e) {
            console.error("Delete Clicr Network Error", e);
            setLastError(`Delete Failed: ${(e as Error).message}`);
            logErrorToUsage(state.currentUser.id, `Delete Clicr Network Error: ${(e as Error).message}`, 'deleteClicr', { clicrId });

            if (originalClicr) setState(prev => ({ ...prev, clicrs: [...prev.clicrs, originalClicr] }));
            return { success: false, error: (e as Error).message };
        }
    };

    const addClicr = async (clicr: Clicr): Promise<{ success: boolean, error?: string }> => {
        // Optimistic Update
        const tempId = clicr.id;
        setState(prev => ({ ...prev, clicrs: [...prev.clicrs, clicr] }));

        try {
            const res = await authFetch({ action: 'ADD_CLICR', payload: clicr });
            if (res.ok) {
                const updatedDB = await res.json();

                // ROBUSTNESS: Ensure new clicr is present
                const exists = updatedDB.clicrs && updatedDB.clicrs.find((c: Clicr) => c.id === clicr.id);
                if (!exists) {
                    updatedDB.clicrs = [...(updatedDB.clicrs || []), clicr];
                }

                setState(prev => ({ ...prev, ...updatedDB }));
                return { success: true };
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error("Failed to add clicr API error", errData);
                // Revert
                setState(prev => ({ ...prev, clicrs: prev.clicrs.filter(c => c.id !== tempId) }));
                return { success: false, error: errData.error || res.statusText };
            }
        } catch (error) {
            console.error("Failed to add clicr network error", error);
            // Revert
            setState(prev => ({ ...prev, clicrs: prev.clicrs.filter(c => c.id !== tempId) }));
            return { success: false, error: (error as Error).message };
        }
    };

    const updateClicr = async (clicr: Clicr) => {
        setState(prev => ({ ...prev, clicrs: prev.clicrs.map(c => c.id === clicr.id ? clicr : c) }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_CLICR', payload: clicr })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to update clicr", error); }
    };

    const addDevice = async (device: Device) => {
        setState(prev => ({ ...prev, devices: [...prev.devices, device] }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ADD_DEVICE', payload: device })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to add device", error); }
    };

    const updateDevice = async (device: Device) => {
        setState(prev => ({ ...prev, devices: prev.devices.map(d => d.id === device.id ? device : d) }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_DEVICE', payload: device })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to update device", error); }
    };

    const deleteDevice = async (deviceId: string) => {
        // Optimistic
        const originalDevice = state.devices.find(d => d.id === deviceId);
        setState(prev => ({ ...prev, devices: prev.devices.filter(d => d.id !== deviceId) }));

        try {
            const res = await authFetch({ action: 'DELETE_DEVICE', payload: { id: deviceId } });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
                return { success: true };
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error("Delete Device Failed", errData);
                setLastError(`Delete Device Failed: ${errData.error || res.statusText}`);
                if (originalDevice) setState(prev => ({ ...prev, devices: [...prev.devices, originalDevice] }));
                return { success: false, error: errData.error };
            }
        } catch (error) {
            console.error("Failed to delete device", error);
            setLastError(`Delete Device Failed: ${(error as Error).message}`);
            if (originalDevice) setState(prev => ({ ...prev, devices: [...prev.devices, originalDevice] }));
            return { success: false, error: (error as Error).message };
        }
    };

    // --- OVERRIDES & LOGS ---

    const addCapacityOverride = async (override: CapacityOverride) => {
        setState(prev => ({ ...prev, capacityOverrides: [...prev.capacityOverrides, override] }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ADD_CAPACITY_OVERRIDE', payload: override })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to add override", error); }
    };

    const addVenueAuditLog = async (log: VenueAuditLog) => {
        setState(prev => ({ ...prev, venueAuditLogs: [...prev.venueAuditLogs, log] }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ADD_VENUE_AUDIT_LOG', payload: log })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to add audit log", error); }
    };

    // --- BANS ---

    const addBan = async (ban: BanRecord) => {
        setState(prev => ({
            ...prev,
            bans: [...(prev.bans || []), ban]
        }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CREATE_BAN', payload: ban })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to add ban", error); }
    };

    const revokeBan = async (banId: string, revokedByUserId: string, reason?: string) => {
        setState(prev => ({
            ...prev,
            bans: (prev.bans || []).map(b => b.id === banId ? { ...b, status: 'REVOKED', revoked_by_user_id: revokedByUserId, revoked_at: Date.now(), revoked_reason: reason } : b)
        }));
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REVOKE_BAN', payload: { banId, revokedByUserId, reason } })
            });
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
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
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CREATE_PATRON_BAN', payload: { person, ban, log } })
            });

            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
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
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE_PATRON_BAN', payload: { ban, log } })
            });

            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
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
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'RECORD_BAN_ENFORCEMENT', payload: event })
            });
            // We don't strictly need to await the full DB sync here, optimizing for speed
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
            if (res.ok) {
                const updatedDB = await res.json();
                setState(prev => ({ ...prev, ...updatedDB }));
            }
        } catch (error) { console.error("Failed to update business", error); }
    };

    const setLastError = (msg: string | null) => {
        setState(prev => ({ ...prev, lastError: msg }));
    }

    return (
        <AppContext.Provider value={{ ...state, setLastError, recordEvent, recordScan, resetCounts, refreshTrafficStats, addUser, updateUser, removeUser, updateBusiness, addClicr, updateClicr, deleteClicr, addVenue, updateVenue, addArea, updateArea, addDevice, updateDevice, deleteDevice, addCapacityOverride, addVenueAuditLog, addBan, revokeBan, createPatronBan, updatePatronBan, recordBanEnforcement }}>
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
