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

        if (rpcError) {
            console.error("RPC Error", rpcError);
            throw new Error(rpcError.message);
        }

        if (rpcData && rpcData.length > 0) {
            const row = rpcData[0];
            return NextResponse.json({
                total_in: Number(row.total_in || 0),
                total_out: Number(row.total_out || 0),
                net_delta: Number(row.net_delta || 0),
                event_count: Number(row.event_count || 0),
                period: { start, end },
                source: 'rpc_core'
            });
        }

        return NextResponse.json({
            total_in: 0,
            total_out: 0,
            net_delta: 0,
            event_count: 0,
            source: 'rpc_core_empty'
        });

    } catch (e) {
        console.error("Traffic API Error", e);
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
