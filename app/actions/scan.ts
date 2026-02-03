'use server';

import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { IDScanEvent } from '@/lib/types';
import { ParsedID } from '@/lib/aamva';

export type ScanResult = {
    status: 'ACCEPTED' | 'DENIED' | 'WARNED' | 'ERROR';
    message: string;
};

export async function submitScanAction(
    venueId: string,
    result: ScanResult, // Just the status/message
    rawDetails: ParsedID // The full parsed ID data
): Promise<IDScanEvent | null> {
    console.log("SERVER ACTION: submitScanAction started for venue:", venueId);

    const issuingState = rawDetails.state || 'Unknown';

    // GENERATE SECURE HASH (Standardized format: ID_NUMBER:STATE uppercase)
    const idString = `${rawDetails.idNumber || ''}:${issuingState}`.toUpperCase();
    const idHash = createHash('sha256').update(idString).digest('hex');

    // 0. SERVER-SIDE BAN CHECK (Source of Truth)
    let finalStatus = result.status === 'DENIED' ? 'DENIED' : 'ACCEPTED';

    // Check if this hash is banned
    const { data: banHit } = await supabaseAdmin
        .from('bans')
        .select('*')
        .eq('id_hash', idHash)
        .eq('active', true)
        .eq('business_id', (await getBusinessId(venueId))) // Optional: Check scope? For now global hash check is safer
        .maybeSingle();

    if (banHit) {
        console.log("SERVER ACTION: DETECTED BAN HIT", banHit.id);
        finalStatus = 'BANNED';
    }

    // 1. Construct the object for scan_events (Legacy/Quick Table)
    const scanEvent = {
        venue_id: venueId,
        scan_result: finalStatus as any, // Cast to match type
        age: rawDetails.age || 0,
        age_band: getAgeBand(rawDetails.age || 0),
        sex: rawDetails.sex || 'U',
        zip_code: rawDetails.postalCode || '',

        // PII
        first_name: rawDetails.firstName || null,
        last_name: rawDetails.lastName || null,
        dob: rawDetails.dateOfBirth || null,
        id_number_last4: rawDetails.idNumber ? rawDetails.idNumber.slice(-4) : null,
        issuing_state: issuingState,
        id_type: 'DRIVERS_LICENSE',

        // Metadata
        timestamp: new Date().toISOString()
    };

    // 2. Persist to scan_events using Admin Client (Bypass RLS)
    const { data, error } = await supabaseAdmin
        .from('scan_events')
        .insert([scanEvent])
        .select()
        .single();

    if (error) {
        console.error("SERVER ACTION ERROR: Supabase Write to scan_events failed:", error);
        throw new Error(`Failed to save scan: ${error.message}`);
    }

    // 3. Optional: Attempt duplicate write to scan_logs for occupancy/analytics
    try {
        const businessId = await getBusinessId(venueId);

        if (businessId) {
            // Write to scan_logs
            await supabaseAdmin.from('scan_logs').insert({
                business_id: businessId,
                venue_id: venueId,
                timestamp: scanEvent.timestamp,
                age: scanEvent.age,
                gender: scanEvent.sex,
                zip_code: scanEvent.zip_code,
                scan_result: finalStatus === 'DENIED' || finalStatus === 'BANNED' ? 'DENIED' : 'ACCEPTED', // Map BANNED to DENIED for analytics enum match
                id_hash: idHash, // REAL HASH
                created_at: scanEvent.timestamp
            });

            // If Accepted, also increment Occupancy
            if (scanEvent.scan_result === 'ACCEPTED') {
                // ... (existing occupancy increment)
                await supabaseAdmin.from('occupancy_events').insert({
                    business_id: businessId,
                    venue_id: venueId,
                    timestamp: scanEvent.timestamp,
                    flow_type: 'IN',
                    delta: 1,
                    event_type: 'SCAN'
                });
            }
        }
    } catch (e) {
        console.warn("SERVER ACTION: Could not sync to scan_logs/occupancy (non-fatal):", e);
    }

    // Convert back to IDScanEvent with correct status
    return {
        ...data,
        scan_result: finalStatus, // Return the BANNED status so UI can react
        timestamp: new Date(data.timestamp).getTime()
    } as IDScanEvent;
}

// Helper to avoid repetitive lookups if possible, but for Safety we fetch fresh
async function getBusinessId(venueId: string) {
    const { data } = await supabaseAdmin.from('venues').select('business_id').eq('id', venueId).single();
    return data?.business_id;
}

export async function getRecentScansAction(venueId?: string): Promise<IDScanEvent[]> {
    let query = supabaseAdmin
        .from('scan_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

    if (venueId) {
        query = query.eq('venue_id', venueId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Supabase Fetch Error:", error);
        return [];
    }

    return data.map((d: any) => ({
        ...d,
        timestamp: new Date(d.timestamp).getTime()
    }));
}

function getAgeBand(age: number): string {
    if (age < 18) return 'Under 18';
    if (age < 21) return '18-20';
    if (age < 25) return '21-24';
    if (age < 30) return '25-29';
    if (age < 40) return '30-39';
    return '40+';
}
