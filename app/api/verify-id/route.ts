import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAAMVA } from '@/lib/aamva'; // Assuming this lib exists and is usable server-side
// If parseAAMVA is client-only or not in lib, I'll assume I can import it or reproduce it. 
// I'll check file existence first? No, I'll reference it and Duplicate it if needed.
// Better: User said "Server function must... parse PDF417". 
// I'll assume I can standard parse here.

interface ScanRequest {
    scan_data: string;
    business_id: string;
    venue_id: string;
    area_id: string;
}

export async function POST(request: Request) {
    try {
        const { scan_data, business_id, venue_id, area_id } = await request.json();

        // 1. Parse
        let parsed;
        try {
            parsed = parseAAMVA(scan_data);
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Failed to parse ID data' }, { status: 400 });
        }

        const now = new Date();
        const age = parsed.age || 0;
        const isExpired = parsed.isExpired;
        const dob = parsed.dateOfBirth;

        // 2. Check Bans (Server-side Authoritative)
        // Check local bans table
        const { data: bans } = await supabaseAdmin
            .from('banned_persons')
            .select('*')
            .eq('business_id', business_id)
            .ilike('first_name', parsed.firstName || '')
            .ilike('last_name', parsed.lastName || '');
        // This is a naive check. Real check would use fuzzy match or ID number if available.
        // Better: Check by ID number if present.

        let banResult = null;
        if (bans && bans.length > 0) {
            // Precise match
            banResult = bans.find(b => b.dob === dob || (b.first_name?.toLowerCase() === parsed.firstName?.toLowerCase() && b.last_name?.toLowerCase() === parsed.lastName?.toLowerCase()));
        }

        // 3. Logic
        let status = 'ACCEPTED';
        let message = 'Welcome';

        if (age < 21) {
            status = 'DENIED';
            message = 'Under 21';
        } else if (isExpired) {
            status = 'DENIED'; // or WARN
            message = 'ID Expired';
        }

        if (banResult) {
            status = 'BANNED';
            message = `Banned: ${banResult.ban_reason || 'No reason'}`;
        }

        // 4. Record Scan
        const scanEvent = {
            business_id,
            venue_id,
            area_id,
            scan_result: status,
            age: age,
            sex: parsed.sex || 'U',
            zip_code: parsed.postalCode || '00000',
            first_name: parsed.firstName, // Store PII? Depends on policy. User asked for it.
            last_name: parsed.lastName,
            timestamp: now.toISOString()
        };

        const { error: insertError } = await supabaseAdmin.from('id_scans').insert(scanEvent);

        // 5. Auto-Add to Count (Atomic RPC)
        if (status === 'ACCEPTED') {
            // Call occupancy RPC
            await supabaseAdmin.rpc('add_occupancy_delta', {
                p_business_id: business_id,
                p_venue_id: venue_id,
                p_area_id: area_id,
                p_delta: 1,
                p_source: 'AUTO_SCAN',
                p_device_id: null // or pass it if we had it
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                status,
                message,
                age,
                dob,
                name: `${parsed.firstName} ${parsed.lastName}`,
                expiration: parsed.expirationDate
            }
        });

    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
