-- 20260205210000_fix_totals_sync.sql
-- CRITICAL FIX: END-TO-END TOTALS SYNC & RESET LOGIC
-- 1. Add last_reset_at to entities
-- 2. Update reset_counts to manage last_reset_at (non-destructive logic)
-- 3. Update get_traffic_totals to respect reset windows
-- 4. Add Summary RPCs for efficient UI loading

-- Transaction block removed for RPC execution compatibility

-- ==============================================================================
-- 1. ADD LAST_RESET_AT
-- ==============================================================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_reset_at timestamptz DEFAULT NULL;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS last_reset_at timestamptz DEFAULT NULL;

-- ==============================================================================
-- 2. UPDATE RESET_COUNTS (Authoritative Reset)
-- ==============================================================================
CREATE OR REPLACE FUNCTION reset_counts(
    p_scope text, -- 'BUSINESS', 'VENUE', 'AREA'
    p_business_id uuid,
    p_venue_id uuid DEFAULT NULL,
    p_area_id uuid DEFAULT NULL,
    p_reason text DEFAULT NULL
)
RETURNS TABLE (
    affected_rows int,
    total_delta_applied bigint,
    reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affected int := 0;
    v_total_delta bigint := 0;
    v_reset_time timestamptz := now();
    r RECORD;
BEGIN
    -- 1. Security
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = p_business_id AND user_id = auth.uid()) THEN
         RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 2. Update Entity last_reset_at
    IF p_scope = 'VENUE' AND p_venue_id IS NOT NULL THEN
        UPDATE venues SET last_reset_at = v_reset_time WHERE id = p_venue_id AND business_id = p_business_id;
        -- Also update child areas?? Typically yes, or logic gets complex. 
        -- Simplification: Resetting a Venue resets all its Areas.
        UPDATE areas SET last_reset_at = v_reset_time WHERE venue_id = p_venue_id AND business_id = p_business_id;
    ELSIF p_scope = 'AREA' AND p_area_id IS NOT NULL THEN
        UPDATE areas SET last_reset_at = v_reset_time WHERE id = p_area_id AND business_id = p_business_id;
    ELSIF p_scope = 'BUSINESS' THEN
        UPDATE venues SET last_reset_at = v_reset_time WHERE business_id = p_business_id;
        UPDATE areas SET last_reset_at = v_reset_time WHERE business_id = p_business_id;
    END IF;

    -- 3. Loop through Occupancy Snapshots and Zero them out
    -- (This remains necessary so "Live Occupancy" is instantly 0)
    FOR r IN 
        SELECT business_id, venue_id, area_id, current_occupancy 
        FROM occupancy_snapshots
        WHERE business_id = p_business_id
        AND (p_scope = 'BUSINESS' OR (p_scope = 'VENUE' AND venue_id = p_venue_id) OR (p_scope = 'AREA' AND area_id = p_area_id))
        AND current_occupancy != 0
        FOR UPDATE
    LOOP
        -- Inverse Event (Audit trail for the drop in occupancy number)
        INSERT INTO occupancy_events (business_id, venue_id, area_id, delta, source, flow_type, event_type)
        VALUES (r.business_id, r.venue_id, r.area_id, -r.current_occupancy, 'RESET', 'OUT', 'RESET');
        
        -- Update Snapshot
        UPDATE occupancy_snapshots 
        SET current_occupancy = 0, updated_at = v_reset_time
        WHERE business_id = r.business_id AND venue_id = r.venue_id AND area_id = r.area_id;

        v_affected := v_affected + 1;
        v_total_delta := v_total_delta + ABS(r.current_occupancy);
    END LOOP;

    -- 4. Audit Log
    INSERT INTO audit_logs (business_id, actor_user_id, action, entity_type, before_json)
    VALUES (p_business_id, auth.uid(), 'RESET_COUNTS', p_scope, jsonb_build_object('venue', p_venue_id, 'area', p_area_id, 'reason', p_reason));

    RETURN QUERY SELECT v_affected, v_total_delta, v_reset_time;
END;
$$;

-- ==============================================================================
-- 3. UPDATE GET_TRAFFIC_TOTALS (Respect Reset Windows)
-- ==============================================================================
-- Drop first to allow return type change
DROP FUNCTION IF EXISTS get_traffic_totals(uuid, uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_traffic_totals(
    p_business_id uuid,
    p_venue_id uuid DEFAULT NULL,
    p_area_id uuid DEFAULT NULL,
    p_start_ts timestamptz DEFAULT NULL, -- If NULL, use last_reset_at or 24h
    p_end_ts timestamptz DEFAULT now()
)
RETURNS TABLE (
    total_in bigint,
    total_out bigint,
    net_delta bigint,
    event_count bigint,
    effective_start_ts timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_ts timestamptz;
    v_reset_ts timestamptz;
BEGIN
    -- Security
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = p_business_id AND user_id = auth.uid()) THEN
        RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, now();
        RETURN;
    END IF;

    -- Determine Reset Time based on Scope
    IF p_area_id IS NOT NULL THEN
        SELECT last_reset_at INTO v_reset_ts FROM areas WHERE id = p_area_id;
    ELSIF p_venue_id IS NOT NULL THEN
        -- If Venue scope, use the Venue's last reset
        SELECT last_reset_at INTO v_reset_ts FROM venues WHERE id = p_venue_id;
    ELSE
        -- Global scope... complicated. Let's default to null (forever) or simple max?
        -- For now, ignore global reset time enforcement unless explicitly managed.
        v_reset_ts := NULL; 
    END IF;

    -- Calculate Effective Start TS
    -- If p_start_ts is provided, use it.
    -- If v_reset_ts is present, ensure we don't look before it IF the user implied "since current session".
    -- Logic: Standard "Totals" are usually "Since Reset".
    -- Reports might request specific historical window (ignoring reset).
    -- We'll assume if p_start_ts is NULL, we want "Current Active Session" (Since Reset).
    
    IF p_start_ts IS NOT NULL THEN
        v_start_ts := p_start_ts;
        -- Optional: If you want to STRICTLY enforce "Data before reset is dead to the dashboard", uncomment:
        -- IF v_reset_ts IS NOT NULL AND v_start_ts < v_reset_ts THEN v_start_ts := v_reset_ts; END IF;
    ELSE
        -- Default window
        v_start_ts := COALESCE(v_reset_ts, now() - interval '24 hours');
    END IF;

    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as total_out,
        COALESCE(SUM(delta), 0) as net_delta,
        COUNT(*) as event_count,
        v_start_ts as effective_start_ts
    FROM occupancy_events oe
    WHERE oe.business_id = p_business_id
    AND (p_venue_id IS NULL OR oe.venue_id = p_venue_id)
    AND (p_area_id IS NULL OR oe.area_id = p_area_id)
    AND oe.created_at >= v_start_ts
    AND oe.created_at <= p_end_ts
    AND oe.event_type != 'RESET'; -- Exclude the technical reset events from "Traffic" counts
END;
$$;

-- ==============================================================================
-- 4. BULK SUMMARIES (For UI Lists)
-- ==============================================================================

-- Get All Venues with their Live Occupancy + Totals (Since their last reset)
CREATE OR REPLACE FUNCTION get_venue_summaries(p_business_id uuid)
RETURNS TABLE (
    venue_id uuid,
    venue_name text,
    current_occupancy bigint,
    capacity int,
    total_in bigint,
    total_out bigint,
    last_reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        COALESCE(SUM(os.current_occupancy), 0)::bigint as current_occupancy,
        v.total_capacity as capacity,
        -- Subquery for totals is safer to avoid join explosion
        (SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) 
         FROM occupancy_events oe 
         WHERE oe.venue_id = v.id 
         AND oe.created_at >= COALESCE(v.last_reset_at, now() - interval '100 years')
         AND oe.event_type != 'RESET'
        )::bigint as total_in,
        (SELECT COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) 
         FROM occupancy_events oe 
         WHERE oe.venue_id = v.id 
         AND oe.created_at >= COALESCE(v.last_reset_at, now() - interval '100 years')
         AND oe.event_type != 'RESET'
        )::bigint as total_out,
        v.last_reset_at
    FROM venues v
    LEFT JOIN occupancy_snapshots os ON os.venue_id = v.id AND os.business_id = p_business_id
    WHERE v.business_id = p_business_id
    AND v.status = 'ACTIVE'
    GROUP BY v.id, v.name, v.total_capacity, v.last_reset_at;
END;
$$;

-- Get All Areas with Live Occupancy + Totals
CREATE OR REPLACE FUNCTION get_area_summaries(p_business_id uuid)
RETURNS TABLE (
    area_id uuid,
    venue_id uuid,
    area_name text,
    current_occupancy bigint,
    capacity int,
    total_in bigint,
    total_out bigint,
    last_reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.venue_id,
        a.name,
        COALESCE(os.current_occupancy, 0)::bigint as current_occupancy,
        COALESCE(a.capacity_max, a.default_capacity, 0) as capacity,
        (SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) 
         FROM occupancy_events oe 
         WHERE oe.area_id = a.id 
         AND oe.created_at >= COALESCE(a.last_reset_at, now() - interval '100 years')
         AND oe.event_type != 'RESET'
        )::bigint as total_in,
        (SELECT COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) 
         FROM occupancy_events oe 
         WHERE oe.area_id = a.id 
         AND oe.created_at >= COALESCE(a.last_reset_at, now() - interval '100 years')
         AND oe.event_type != 'RESET'
        )::bigint as total_out,
        a.last_reset_at
    FROM areas a
    LEFT JOIN occupancy_snapshots os ON os.area_id = a.id
    WHERE a.business_id = p_business_id
    AND a.is_active = true;
END;
$$;

-- Transaction block removed for RPC execution compatibility
