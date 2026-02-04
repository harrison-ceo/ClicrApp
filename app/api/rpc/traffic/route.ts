import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const { business_id, venue_id, area_id, start_ts, end_ts } = await request.json();

        if (!business_id) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }

        // Validate Timestamps (Required for correctness)
        const start = start_ts ? new Date(start_ts).toISOString() : new Date(Date.now() - 86400000).toISOString();
        const end = end_ts ? new Date(end_ts).toISOString() : new Date().toISOString();

        // 1. Try RPC Approach (Optimal)
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_traffic_totals', {
            p_business_id: business_id,
            p_venue_id: venue_id || null,
            p_area_id: area_id || null,
            p_start_ts: start,
            p_end_ts: end
        });

        if (!rpcError && rpcData && rpcData.length > 0) {
            // RPC returns array of 1 row usually
            const row = rpcData[0];
            return NextResponse.json({
                total_in: Number(row.total_in || 0),
                total_out: Number(row.total_out || 0),
                net_delta: Number(row.net_delta || 0),
                event_count: Number(row.event_count || 0),
                period: { start, end },
                source: 'rpc'
            });
        }

        // 2. Fallback: Aggregation in Node (Robustness)
        console.warn("Traffic RPC failed or missing, falling back to local aggregation:", rpcError?.message);

        let query = supabaseAdmin
            .from('occupancy_events')
            .select('delta, flow_type, source')
            .eq('business_id', business_id)
            .gte('timestamp', start)
            .lte('timestamp', end);

        if (venue_id) query = query.eq('venue_id', venue_id);
        if (area_id) query = query.eq('area_id', area_id);

        const { data: events, error } = await query;

        if (error) throw error;

        let total_in = 0;
        let total_out = 0;
        let net_delta = 0;
        const event_count = events?.length || 0;

        events?.forEach((e: any) => {
            if (e.source === 'reset') {
                net_delta += e.delta;
                return;
            }
            const d = e.delta;
            net_delta += d;
            if (d > 0) total_in += d;
            else total_out += Math.abs(d);
        });

        return NextResponse.json({
            total_in,
            total_out,
            net_delta,
            event_count,
            period: { start, end },
            source: 'fallback_node'
        });

    } catch (e) {
        console.error("Traffic API Error", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
