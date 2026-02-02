import { addDays, isAfter } from 'date-fns';

export type StateCode = 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

export interface ComplianceRule {
    stateCode: StateCode;
    retentionDays: number; // How long PII can be stored. -1 for Indefinite.
    storeImage: boolean; // Can we store the image of the ID?
    storePII: boolean; // Can we store Name, Address, etc?
    maskDLNumber: boolean; // Must we mask the License Number?
    ageVerificationOnDeviceOnly: boolean; // If true, never send PII to cloud, only "21+" result.
}

// Default Rule (Permissive)
const DEFAULT_RULE: ComplianceRule = {
    stateCode: 'TX', // Placeholder
    retentionDays: 30,
    storeImage: false,
    storePII: true,
    maskDLNumber: false,
    ageVerificationOnDeviceOnly: false,
};

// State Specific Rules
// DISCLAIMER: These are example rules. Real legal counsel required for production.
const STATE_RULES: Record<string, ComplianceRule> = {
    'CA': {
        stateCode: 'CA',
        retentionDays: 0, // "Verify and Discard" generally preferred for non-consent
        storeImage: false,
        storePII: false, // Minimization
        maskDLNumber: true,
        ageVerificationOnDeviceOnly: true, // Strict privacy
    },
    'TX': {
        stateCode: 'TX',
        retentionDays: 7,
        storeImage: false,
        storePII: true,
        maskDLNumber: false,
        ageVerificationOnDeviceOnly: false,
    },
    'NY': {
        stateCode: 'NY',
        retentionDays: 1, // 24 hours often cited for limited venues
        storeImage: false,
        storePII: false,
        maskDLNumber: true,
        ageVerificationOnDeviceOnly: true,
    },
    'FL': {
        stateCode: 'FL',
        retentionDays: 90, // Often used for affirmative defense
        storeImage: true,
        storePII: true,
        maskDLNumber: false,
        ageVerificationOnDeviceOnly: false,
    },
    // ... Add more as needed
};

export class ComplianceEngine {

    /**
     * Get the compliance rule for a specific state.
     * Falls back to a generic distinct rule if not found.
     */
    static getRule(state: string): ComplianceRule {
        return STATE_RULES[state] || { ...DEFAULT_RULE, stateCode: state as StateCode };
    }

    /**
     * Determines if a specific scan record is actively compliant or should be purged.
     */
    static isScanCompliant(scanDate: Date, state: string): boolean {
        const rule = this.getRule(state);
        if (rule.retentionDays === -1) return true; // Indefinite

        const expirationDate = addDays(scanDate, rule.retentionDays);
        // If today is AFTER expiration date, it is NOT compliant
        return !isAfter(new Date(), expirationDate);
    }

    /**
     * Sanitizes PII based on state rules before storage.
     * Returns a "Safe" object to save to DB.
     */
    static sanitizeForStorage(scanData: any, state: string) {
        const rule = this.getRule(state);

        let sanitized = { ...scanData };

        if (rule.ageVerificationOnDeviceOnly) {
            // Strip everything except the boolean result and timestamp
            sanitized = {
                timestamp: sanitized.timestamp,
                is_valid: sanitized.is_valid,
                age_valid: sanitized.age_valid,
                venue_id: sanitized.venue_id,
            };
            return sanitized;
        }

        if (!rule.storePII) {
            delete sanitized.first_name;
            delete sanitized.last_name;
            delete sanitized.address;
            delete sanitized.dob; // Keep calculated age if needed, but remove DOB
        }

        if (rule.maskDLNumber && sanitized.license_number) {
            sanitized.license_number = '*****' + sanitized.license_number.slice(-4);
        }

        if (!rule.storeImage) {
            delete sanitized.image_data;
        }

        return sanitized;
    }

    /**
     * Returns a user-friendly message explaining why data isn't available.
     */
    static getRestrictionReason(state: string): string | null {
        const rule = this.getRule(state);
        if (rule.ageVerificationOnDeviceOnly) return `Data storage restricted by ${state} privacy laws.`;
        if (!rule.storePII) return `PII storage restricted by ${state} privacy laws.`;
        return null;
    }
}
