import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const { business_id, scope, target_id, user_id } = await request.json();

        if (!business_id || !scope) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Resolve Target Areas
        let targetAreaIds: string[] = [];
        let venueIdForScope: string | null = null; // optimizing fetch

        if (scope === 'AREA') {
            targetAreaIds = [target_id];
        } else if (scope === 'VENUE') {
            const { data: areas } = await supabaseAdmin.from('areas').select('id').eq('venue_id', target_id);
            if (areas) targetAreaIds = areas.map(a => a.id);
            venueIdForScope = target_id;
        } else if (scope === 'BUSINESS') {
            const { data: areas } = await supabaseAdmin.from('areas').select('id, venue_id').eq('venue_id.business_id', business_id);
            // Note: recursive relationship might fail depending on schema. 
            // Safer: Get venues for business, then areas for venues.
            const { data: venues } = await supabaseAdmin.from('venues').select('id').eq('business_id', business_id);
            const vIds = venues?.map(v => v.id) || [];
            const { data: bAreas } = await supabaseAdmin.from('areas').select('id').in('venue_id', vIds);
            targetAreaIds = bAreas?.map(a => a.id) || [];
        }

        if (targetAreaIds.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'No areas found to reset' });
        }

        // 2. Get Current Snapshots (to calculate delta)
        const { data: snapshots } = await supabaseAdmin
            .from('occupancy_snapshots')
            .select('area_id, current_occupancy, venue_id')
            .in('area_id', targetAreaIds)
            .gt('current_occupancy', 0); // Only reset what needs resetting

        if (!snapshots || snapshots.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'Already zero' });
        }

        // 3. Prepare Writes
        const timestamp = new Date().toISOString();
        const events = snapshots.map(s => ({
            business_id,
            venue_id: s.venue_id,
            area_id: s.area_id,
            delta: -s.current_occupancy,
            event_type: 'RESET',
            flow_type: 'OUT',
            user_id: user_id || null, // Optional, can be null
            timestamp,
            // device_id? If reset from web, likely no device.
        }));

        const snapshotUpdates = snapshots.map(s => ({
            area_id: s.area_id,
            business_id,
            venue_id: s.venue_id,
            current_occupancy: 0,
            updated_at: timestamp,
            // We should ideally link to the event_id, but we don't have it yet.
            // Simplified flow: Just set to 0.
        }));

        // 4. Execute "Transaction" (Parallel)
        // Since we can't do real SQL transaction without RPC, we do best effort.
        const { error: eventError } = await supabaseAdmin.from('occupancy_events').insert(events);
        if (eventError) throw eventError;

        const { error: snapError } = await supabaseAdmin.from('occupancy_snapshots').upsert(snapshotUpdates);
        if (snapError) throw snapError;

        return NextResponse.json({ success: true, count: snapshots.length });

    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
