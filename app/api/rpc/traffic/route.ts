import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Helper to get start/end of day in UTC or specific offset
// Logic: If user passes 'Today', we default to UTC day.
function getTimeRange(rangeType: string, customStart?: string, customEnd?: string) {
    const now = new Date();

    if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
    }

    if (rangeType === 'TODAY' || !rangeType) {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        return { start: start.toISOString(), end: now.toISOString() };
    }

    // Default fallback
    return { start: new Date(Date.now() - 86400000).toISOString(), end: now.toISOString() };
}

export async function POST(request: Request) {
    try {
        const { business_id, venue_id, area_id, range_type, start_ts, end_ts } = await request.json();

        if (!business_id) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }

        const { start, end } = getTimeRange(range_type, start_ts, end_ts);

        // Fetch Events
        let query = supabaseAdmin
            .from('occupancy_events')
            .select('area_id, delta')
            .eq('business_id', business_id)
            .gte('timestamp', start)
            .lte('timestamp', end);

        if (venue_id) query = query.eq('venue_id', venue_id);
        if (area_id) query = query.eq('area_id', area_id);

        const { data: events, error } = await query;

        if (error) throw error;

        // Aggregate locally
        const statsMap: Record<string, { in: number, out: number }> = {};

        events?.forEach((e: any) => {
            if (!statsMap[e.area_id]) statsMap[e.area_id] = { in: 0, out: 0 };
            if (e.delta > 0) {
                statsMap[e.area_id].in += e.delta;
            } else {
                statsMap[e.area_id].out += Math.abs(e.delta);
            }
        });

        // If specific area requested, return object, else array
        if (area_id) {
            return NextResponse.json({
                area_id,
                ...statsMap[area_id] || { in: 0, out: 0 },
                period: { start, end }
            });
        }

        // Return array for all found areas
        const stats = Object.entries(statsMap).map(([id, val]) => ({
            area_id: id,
            total_in: val.in,
            total_out: val.out
        }));

        return NextResponse.json({ stats, period: { start, end } });

    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
