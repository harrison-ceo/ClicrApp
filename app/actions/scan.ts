'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { ComplianceEngine } from '@/lib/compliance';
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

    // 1. Construct the object for scan_events (Legacy/Quick Table)
    const scanEvent = {
        venue_id: venueId,
        scan_result: result.status === 'DENIED' ? 'DENIED' : 'ACCEPTED',
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
        // Throwing error so client knows something went wrong
        throw new Error(`Failed to save scan: ${error.message}`);
    }

    console.log("SERVER ACTION SUCCESS: Saved to scan_events:", data.id);

    // 3. Optional: Attempt duplicate write to scan_logs for occupancy/analytics if schema allows
    // We try to find business_id from venueId first. This is a "best effort" look up.
    try {
        const { data: venueData } = await supabaseAdmin
            .from('venues')
            .select('business_id, id')
            .eq('id', venueId)
            .single();

        if (venueData && venueData.business_id) {
            // Write to scan_logs
            await supabaseAdmin.from('scan_logs').insert({
                business_id: venueData.business_id,
                venue_id: venueData.id,
                timestamp: scanEvent.timestamp,
                age: scanEvent.age,
                gender: scanEvent.sex,
                zip_code: scanEvent.zip_code,
                scan_result: result.status === 'DENIED' ? 'DENIED' : 'ACCEPTED',
                id_hash: 'todo-hash', // Placeholder
                created_at: scanEvent.timestamp
            });
            console.log("SERVER ACTION: Also synced to scan_logs");

            // If Accepted, also increment Occupancy
            if (scanEvent.scan_result === 'ACCEPTED') {
                await supabaseAdmin.from('occupancy_events').insert({
                    business_id: venueData.business_id,
                    venue_id: venueData.id,
                    timestamp: scanEvent.timestamp,
                    flow_type: 'IN', // Scanning implies entry
                    delta: 1,
                    event_type: 'SCAN'
                });
                console.log("SERVER ACTION: Incremented Occupancy");
            }
        }
    } catch (e) {
        console.warn("SERVER ACTION: Could not sync to scan_logs/occupancy (non-fatal):", e);
    }

    // Convert back to IDScanEvent
    return {
        ...data,
        timestamp: new Date(data.timestamp).getTime()
    } as IDScanEvent;
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
