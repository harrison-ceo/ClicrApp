import { Venue } from './types';

export interface CapacityRules {
    maxCapacity: number;
    mode: 'WARN_ONLY' | 'HARD_STOP' | 'MANAGER_OVERRIDE' | 'HARD_BLOCK';
    enforceBy: 'VENUE' | 'AREA';
}

export function getVenueCapacityRules(venue: Venue | undefined): CapacityRules {
    if (!venue) {
        return {
            maxCapacity: 0,
            mode: 'WARN_ONLY',
            enforceBy: 'VENUE'
        };
    }

    // Single Logic source
    // In future this can look up the settings table if we migrate
    // For now, it standardizes the fallback logic
    return {
        maxCapacity: venue.default_capacity_total || 0,
        mode: venue.capacity_enforcement_mode || 'WARN_ONLY',
        enforceBy: 'VENUE' // Default to Venue-wide for now
    };
}
