'use server';

import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAAMVA, isExpired, getAge } from '@/lib/scanning/aamva-parser';
import crypto from 'crypto';

// --- Types ---

export type ScanResult = {
    outcome: 'ACCEPTED' | 'DENIED';
    reason?: 'UNDERAGE' | 'EXPIRED' | 'BANNED' | 'INVALID_FORMAT' | 'VERIFICATION_FAILED';
    data: {
        firstName: string | null;
        lastName: string | null;
        age: number | null;
        gender: string | null;
        dob: string | null; // Masked or partial if needed, but we pass full back to UI for session view usually
        expirationDate: string | null;
        issuingState: string | null;
    };
    banDetails?: {
        reason: string;
        notes?: string;
        period: string; // "Permanent" or date
    };
};

export type ScanPayload = {
    raw: string;
    venueId: string;
    areaId?: string; // Optional
    deviceId?: string; // Optional
};

// --- Helpers ---

function generateIdentityHash(state: string, number: string, dob: string): string {
    const salt = process.env.ID_HASH_SALT || 'fallback_salt_do_not_use_in_prod';
    const input = `${state.toUpperCase().trim()}:${number.toUpperCase().trim()}:${dob.trim()}`;
    return crypto.createHmac('sha256', salt).update(input).digest('hex');
}

// --- Actions ---

export async function processScan(payload: ScanPayload): Promise<{ success: boolean; result?: ScanResult; error?: string }> {
    try {
        // 1. Auth Check (Standard User)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        // Get Business ID
        // Optimized: assume user has claim or we fetch it quick. For now, fetch.
        const { data: member } = await supabase.from('business_members')
            .select('business_id, business:businesses(settings)')
            .eq('user_id', user.id)
            .single();

        if (!member) return { success: false, error: 'No business membership found.' };
        const businessId = member.business_id;
        const settings = (member.business as any)?.settings || {};
        const ageThreshold = settings.age_threshold || 21;

        // 2. Parse
        let parsed = parseAAMVA(payload.raw);

        // Basic Validation
        if (!parsed.idNumber || !parsed.issuingState || !parsed.dob) {
            // Fallback: Try simpler barcode parse or return error
            // For now, strict AAMVA
            return {
                success: false, result: {
                    outcome: 'DENIED',
                    reason: 'INVALID_FORMAT',
                    data: { ...parsed, age: null }
                }
            };
        }

        // 3. Compute Hash
        const identityHash = generateIdentityHash(parsed.issuingState, parsed.idNumber, parsed.dob);

        // 4. Check Bans (Using Admin Client to bypass RLS if needed, though RLS should allow reading bans for own business)
        // We use admin here to ensure we see ALL bans even if RLS is tricky, but let's stick to RLS correct flow.
        // Actually, 'bans' are sensitive. Regular staff might just need to know "IS BANNED" not "WHY".
        // Let's use supabaseAdmin for the ban lookup to be safe and rigorous.

        const { data: activeBans } = await supabaseAdmin
            .from('bans')
            .select('*')
            .eq('business_id', businessId)
            .eq('identity_token_hash', identityHash)
            .eq('active', true)
            .or(`end_at.is.null,end_at.gt.now`);

        const hasBusinessBan = activeBans?.some(b => b.venue_id === null);
        const hasVenueBan = activeBans?.some(b => b.venue_id === payload.venueId);
        const activeBan = activeBans?.find(b => b.venue_id === null || b.venue_id === payload.venueId);

        // 5. Determine Outcome
        let outcome: 'ACCEPTED' | 'DENIED' = 'ACCEPTED';
        let reason: any = undefined;

        const age = getAge(parsed.dob);
        const expired = isExpired(parsed.expirationDate);

        if (hasBusinessBan || hasVenueBan) {
            outcome = 'DENIED';
            reason = 'BANNED';
        } else if (age !== null && age < ageThreshold) {
            outcome = 'DENIED';
            reason = 'UNDERAGE';
        } else if (expired) {
            outcome = 'DENIED';
            reason = 'EXPIRED';
        }

        // 6. Record Identity (Upsert)
        // We store minimal fields.
        await supabaseAdmin.from('identities').upsert({
            business_id: businessId,
            identity_token_hash: identityHash,
            issuing_region: parsed.issuingState,
            dob_year: parsed.dob ? parseInt(parsed.dob.substring(0, 4)) : null,
            initials: `${parsed.firstName?.[0] || ''}${parsed.lastName?.[0] || ''}`,
            // We usually don't store full name unless policy updates
        }, { onConflict: 'business_id, identity_token_hash' });

        // 7. Log Scan
        await supabaseAdmin.from('id_scans').insert({
            business_id: businessId,
            venue_id: payload.venueId,
            area_id: payload.areaId || null,
            device_id: payload.deviceId || null,
            user_id: user.id,
            identity_token_hash: identityHash,
            outcome,
            denial_reason: reason,
            metadata_json: {
                age,
                gender: parsed.gender,
                zip: parsed.postalCode
            }
        });

        // 8. Auto-Increment Occupancy (If Accepted and Area specified)
        if (outcome === 'ACCEPTED') {
            const autoAdd = true; // TODO: Fetch from settings
            if (autoAdd && payload.areaId) {
                // Use User Client (supabase) to trigger RPC, ensuring proper permissions and snapshot updates
                const { error: rpcError } = await supabase.rpc('apply_occupancy_delta', {
                    p_business_id: businessId,
                    p_venue_id: payload.venueId,
                    p_area_id: payload.areaId,
                    p_delta: 1,
                    p_source: 'scan',
                    p_device_id: payload.deviceId
                });

                if (rpcError) {
                    console.error("Auto-Add Occupancy Failed:", rpcError);
                    // Don't fail the scan, just log
                }
            }
        }

        // 9. Return Result
        return {
            success: true,
            result: {
                outcome,
                reason,
                data: {
                    firstName: parsed.firstName,
                    lastName: parsed.lastName,
                    age,
                    gender: parsed.gender,
                    dob: parsed.dob,
                    expirationDate: parsed.expirationDate,
                    issuingState: parsed.issuingState
                },
                banDetails: activeBan ? {
                    reason: activeBan.reason_code || 'Unspecified',
                    notes: activeBan.notes,
                    period: activeBan.end_at ? `Until ${new Date(activeBan.end_at).toLocaleDateString()}` : 'Permanent'
                } : undefined
            }
        };

    } catch (err: any) {
        console.error("[Process Scan] Error:", err);
        return { success: false, error: err.message };
    }
}

export async function banPatron(scanId: string | null, manualData: any | null, banDetails: any) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        // Check Permissions (Manager only?)
        // For now allow staff to ban, or verify role.

        let identityHash = '';
        let businessId = '';

        if (scanId) {
            // Fetch from scan log
            // Use admin to ensure we get it
            const { data: scan } = await supabaseAdmin
                .from('id_scans')
                .select('identity_token_hash, business_id')
                .eq('id', scanId)
                .single();

            if (!scan) return { success: false, error: 'Scan record not found' };
            identityHash = scan.identity_token_hash;
            businessId = scan.business_id;

        } else if (manualData) {
            // Manual Ban
            const { data: member } = await supabase.from('business_members').select('business_id').eq('user_id', user.id).single();
            if (!member) return { error: 'No business' };
            businessId = member.business_id;

            // validate manualData keys
            const { state, idNumber, dob } = manualData;
            if (!state || !idNumber || !dob) return { success: false, error: 'Missing ID details' };

            // Normalize DOB to YYYYMMDD? UI likely sends ISO or formatted.
            // Assume UI sends YYYYMMDD for simplicity or we format it.
            identityHash = generateIdentityHash(state, idNumber, dob);
        }

        // Insert Ban
        await supabaseAdmin.from('bans').insert({
            business_id: businessId,
            venue_id: banDetails.scope === 'VENUE' ? banDetails.venueId : null,
            identity_token_hash: identityHash,
            reason_code: banDetails.reason,
            notes: banDetails.notes,
            end_at: banDetails.duration === 'PERMANENT' ? null : banDetails.endDate,
            created_by: user.id
        });

        // Audit Log
        await supabaseAdmin.from('audit_logs').insert({
            business_id: businessId,
            actor_user_id: user.id,
            action: 'BAN_GUEST',
            details: { hash_preview: identityHash.substring(0, 8), ...banDetails }
        });

        return { success: true };
    } catch (err: any) {
        console.error("Ban Error", err);
        return { success: false, error: err.message };
    }
}
