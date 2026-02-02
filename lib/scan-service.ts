
import { ParsedID } from './aamva';
import { PatronBan, BannedPerson, IDScanEvent } from './types';


// Mock DB interactions for now - in production this would query Supabase real-time
// but we want to simulate robust logic here.

export type ScanResult = {
    status: 'ACCEPTED' | 'DENIED' | 'WARNED' | 'ERROR';
    message: string;
    patron?: BannedPerson;
    activeBan?: PatronBan;
    parsedId?: ParsedID;
    age?: number;
};

// Advanced Matching Logic to find if a scanned ID matches a banned person
// We use ID Number + State primarily, but fallback to Name + DOB for robustness
export function findMatchingBan(
    parsedId: ParsedID,
    patrons: BannedPerson[],
    bans: PatronBan[],
    venueId: string
): { patron?: BannedPerson, ban?: PatronBan } {

    // 1. Strict Match: ID Number + State
    if (parsedId.idNumber && parsedId.state) {
        const match = patrons.find(p =>
            p.id_number_full === parsedId.idNumber &&
            p.issuing_state_or_country === parsedId.state
        );
        if (match) {
            // Check for active bans
            const activeBan = bans.find(b =>
                b.banned_person_id === match.id &&
                b.status === 'ACTIVE' &&
                (b.applies_to_all_locations || b.location_ids.includes(venueId))
            );
            if (activeBan) return { patron: match, ban: activeBan };
        }
    }

    // 2. Fuzzy Match: Name + DOB (if ID number missing or changed)
    if (parsedId.firstName && parsedId.lastName && parsedId.dateOfBirth) {
        const match = patrons.find(p =>
            p.first_name.toLowerCase() === parsedId.firstName?.toLowerCase() &&
            p.last_name.toLowerCase() === parsedId.lastName?.toLowerCase() &&
            p.date_of_birth === parsedId.dateOfBirth
        );
        if (match) {
            const activeBan = bans.find(b =>
                b.banned_person_id === match.id &&
                b.status === 'ACTIVE' &&
                (b.applies_to_all_locations || b.location_ids.includes(venueId))
            );
            if (activeBan) return { patron: match, ban: activeBan };
        }
    }

    return {};
}

export function evaluateScan(parsedId: ParsedID, patrons: BannedPerson[], bans: PatronBan[], venueId: string): ScanResult {
    // 1. Check Age (21+)
    if (parsedId.age !== null && parsedId.age < 21) {
        return {
            status: 'DENIED',
            message: `UNDERAGE (${parsedId.age})`,
            parsedId,
            age: parsedId.age
        };
    }

    // 2. Check Expiration
    if (parsedId.isExpired) {
        return {
            status: 'DENIED',
            message: 'EXPIRED ID',
            parsedId,
            age: parsedId.age || 0
        };
    }

    // 3. Check Bans
    const { patron, ban } = findMatchingBan(parsedId, patrons, bans, venueId);
    if (ban && patron) {
        return {
            status: 'DENIED',
            message: `BANNED: ${ban.reason_category}`,
            patron,
            activeBan: ban,
            parsedId,
            age: parsedId.age || 0
        };
    }

    return {
        status: 'ACCEPTED',
        message: 'Entry Allowed',
        parsedId,
        age: parsedId.age || 0
    };
}

export function getAgeBand(age: number): string {
    if (age < 18) return 'Under 18';
    if (age < 21) return '18-20';
    if (age < 25) return '21-24';
    if (age < 30) return '25-29';
    if (age < 40) return '30-39';
    return '40+';
}
