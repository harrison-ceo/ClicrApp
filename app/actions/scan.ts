'use server';

import { addScan } from '@/lib/db';
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
): Promise<IDScanEvent> {

    const issuingState = rawDetails.state || 'Unknown';

    // 1. Construct the specific data object we WANT to save
    const rawRecord: Partial<IDScanEvent> = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        venue_id: venueId,
        scan_result: result.status === 'DENIED' ? 'DENIED' : 'ACCEPTED',
        age: rawDetails.age || 0,
        age_band: getAgeBand(rawDetails.age || 0),
        sex: rawDetails.sex || 'U',
        zip_code: rawDetails.postalCode || '',

        // PII Fields (Candidates for Redaction)
        first_name: rawDetails.firstName || undefined,
        last_name: rawDetails.lastName || undefined,
        dob: rawDetails.dateOfBirth || undefined,
        id_number_last4: rawDetails.idNumber ? rawDetails.idNumber.slice(-4) : undefined,
        issuing_state: issuingState,
        id_type: 'DL',
        address_street: rawDetails.addressStreet || undefined,
        city: rawDetails.city || undefined,
        state: rawDetails.state || undefined
    };

    // 2. Pass through Compliance Engine
    // This removes fields like first_name, address, etc if the state (e.g. CA) forbids it.
    const sanitizedRecord = ComplianceEngine.sanitizeForStorage(rawRecord, issuingState) as IDScanEvent;

    // 3. Persist to Storage (Server-Side DB Call)
    // This runs on the server, so 'fs' in db.ts is allowed.
    addScan(sanitizedRecord);

    return sanitizedRecord;
}

function getAgeBand(age: number): string {
    if (age < 18) return 'Under 18';
    if (age < 21) return '18-20';
    if (age < 25) return '21-24';
    if (age < 30) return '25-29';
    if (age < 40) return '30-39';
    return '40+';
}
