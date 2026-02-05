
import { getSupabase } from './supabase';
import { getTodayWindow } from './time';
import { logError } from './errors';

export interface TrafficTotals {
    total_in: number;
    total_out: number;
    net_delta: number;
    event_count: number;
    manual_in?: number;
    scan_in?: number;
    turnarounds?: number;
    net_adjusted?: number;
}

export const METRICS = {
    getTotals: async (
        businessId: string,
        scope: { venueId?: string; areaId?: string },
        window = getTodayWindow()
    ): Promise<TrafficTotals> => {
        const sb = getSupabase();

        const params = {
            p_business_id: businessId,
            p_venue_id: scope.venueId || null,
            p_area_id: scope.areaId || null,
            p_start_ts: window.start,
            p_end_ts: window.end
        };

        // Use new P0 Reporting RPC
        const { data, error } = await sb.rpc('get_report_summary', params);

        if (error) {
            logError('metrics:getTotals', error.message, params, undefined, businessId);
            throw error;
        }

        if (data && data.length > 0) {
            const r = data[0];
            return {
                total_in: Number(r.total_entries_gross),
                total_out: Number(r.total_exits_gross),
                net_delta: Number(r.total_entries_gross) - Number(r.total_exits_gross),
                event_count: 0,
                manual_in: Number(r.entries_manual),
                scan_in: Number(r.entries_scan),
                turnarounds: Number(r.turnarounds_count),
                net_adjusted: Number(r.net_entries_adjusted)
            };
        }

        return { total_in: 0, total_out: 0, net_delta: 0, event_count: 0 };
    },

    getCurrentOccupancy: async (businessId: string, areaId: string): Promise<number> => {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('occupancy_snapshots')
            .select('current_occupancy')
            .eq('business_id', businessId)
            .eq('area_id', areaId)
            .single();

        if (error) {
            // It might be missing if no events yet. Return 0.
            if (error.code === 'PGRST116') return 0; // No rows
            logError('metrics:occupancy', error.message, { areaId }, undefined, businessId);
            return 0;
        }
        return data?.current_occupancy || 0;
    },

    getAreaSummaries: async (venueId: string) => {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('get_area_summaries', { p_venue_id: venueId });
        if (error) throw error;
        return data || [];
    },

    getVenueSummaries: async (businessId: string) => {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('get_venue_summaries', { p_business_id: businessId });
        if (error) throw error;
        return data || [];
    },

    getDailyTrafficSummary: async (businessId: string, venueId: string, startDate: string, endDate: string) => {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('get_daily_traffic_summary', {
            p_business_id: businessId,
            p_venue_id: venueId,
            p_start_date: startDate,
            p_end_date: endDate
        });
        if (error) throw error;
        return data || [];
    },

    checkBanStatus: async (businessId: string, patronId: string, venueId?: string) => {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('check_ban_status', {
            p_business_id: businessId,
            p_patron_id: patronId,
            p_venue_id: venueId || null
        });
        if (error) {
            console.error("Ban check failed", error);
            return { is_banned: false };
        }
        return data;
    }
};
