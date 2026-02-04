import { Area, Venue } from "./types";

export interface TrafficStats {
    total_in: number;
    total_out: number;
    net_delta: number;
    event_count: number;
    period: {
        start: string;
        end: string;
    };
    source?: string;
}

export type Scope = {
    business_id: string;
    venue_id?: string;
    area_id?: string;
};

// Standard Time Window Helper
export const getTodayWindow = () => {
    // Get Local Start/End of Day
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
};

// 1. Get Traffic Totals (Calls API)
export const getTrafficTotals = async (scope: Scope, window = getTodayWindow()): Promise<TrafficStats> => {
    try {
        const res = await fetch('/api/rpc/traffic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                business_id: scope.business_id,
                venue_id: scope.venue_id,
                area_id: scope.area_id,
                start_ts: window.start,
                end_ts: window.end
            })
        });

        if (!res.ok) {
            throw new Error(`Traffic API Error: ${res.statusText}`);
        }

        const data = await res.json();
        console.log(`[Metrics] Traffic Totals (${scope.area_id ? 'Area' : (scope.venue_id ? 'Venue' : 'Biz')}):`, data);
        return data;
    } catch (e) {
        console.error("Metrics Service Error:", e);
        // Fail Safe w/ Zeros and log
        return {
            total_in: 0,
            total_out: 0,
            net_delta: 0,
            event_count: 0,
            period: window,
            source: 'error_fallback'
        };
    }
};

// 2. Get Current Occupancy (Selector from Live State or DB)
// Using State is preferred for Realtime UI.
// If valid state is passed, calculates from it.
export const getCurrentOccupancy = (areas: Area[], scope: Scope): number => {
    const relevantAreas = areas.filter(a => {
        // Business check implied if areas list is already filtered or if we check a.business_id
        if (scope.venue_id && a.venue_id !== scope.venue_id) return false;
        if (scope.area_id && a.id !== scope.area_id) return false;
        return true;
    });

    return relevantAreas.reduce((sum, a) => sum + (a.current_occupancy || 0), 0);
};

// 3. Get Venue Summaries (Grouped)
// Useful for Venues Tab
export const getVenueSummaries = (venues: Venue[], areas: Area[]) => {
    return venues.map(v => ({
        ...v,
        live_occupancy: getCurrentOccupancy(areas, { business_id: v.business_id, venue_id: v.id })
    }));
};

// 4. Get Area Summaries (Detail)
export const getAreaSummaries = (areas: Area[], venueId: string) => {
    return areas
        .filter(a => a.venue_id === venueId)
        .map(a => {
            const current = a.current_occupancy || 0;
            const capacity = a.default_capacity || 0;
            const percent = capacity > 0 ? Math.round((current / capacity) * 100) : 0;

            return {
                id: a.id,
                name: a.name,
                current_occupancy: current,
                capacity: capacity,
                percent_full: percent,
                type: a.area_type,
                mode: a.counting_mode
            };
        });
};
