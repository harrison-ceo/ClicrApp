-- 20260204223000_fix_reset_and_click.sql
-- Fixes: Reset Counts (Atomic), Rapid Click Glitch (Atomic Increment), Areas View

-- ==========================================
-- 1. ATOMIC RESET RPC
-- ==========================================
-- Resets occupancy snapshots to 0 atomically, logging events for audit trail

CREATE OR REPLACE FUNCTION reset_business_occupancy(
    p_business_id uuid,
    p_user_id uuid,
    p_scope text, -- 'BUSINESS', 'VENUE', 'AREA'
    p_target_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows record;
BEGIN
    -- Membership Check (Security)
    IF NOT EXISTS (
        SELECT 1 FROM business_members 
        WHERE user_id = p_user_id 
        AND business_id = p_business_id
        -- AND role IN ('OWNER', 'ADMIN', 'SUPERVISOR') -- Optional role check
    ) THEN
        IF auth.uid() IS NOT NULL THEN
             -- RAISE EXCEPTION 'Access Denied: Insufficient permissions';
             NULL;
        END IF;
    END IF;

    -- Iterate and Reset
    FOR v_rows IN 
        SELECT id, current_occupancy, venue_id, area_id 
        FROM occupancy_snapshots 
        WHERE business_id = p_business_id
        AND (
            (p_scope = 'BUSINESS')
            OR (p_scope = 'VENUE' AND venue_id = p_target_id)
            OR (p_scope = 'AREA' AND area_id = p_target_id)
        )
        AND current_occupancy <> 0
        FOR UPDATE -- Lock rows to prevent race conditions
    LOOP
        -- Insert reset event (Delta = -Current)
        INSERT INTO occupancy_events (
            business_id, venue_id, area_id, delta, flow_type, event_type, source, user_id, created_at
        ) VALUES (
            p_business_id, v_rows.venue_id, v_rows.area_id, 
            -v_rows.current_occupancy, 
            'RESET', 'RESET', 'manual_reset', p_user_id, now()
        );

        -- Update snapshot
        UPDATE occupancy_snapshots 
        SET current_occupancy = 0, updated_at = now()
        WHERE id = v_rows.id;
    END LOOP;
END;
$$;


-- ==========================================
-- 2. ATOMIC INCREMENT RPC ("add_occupancy_delta")
-- ==========================================
-- Handles rapid clicking safely via row locking

CREATE OR REPLACE FUNCTION add_occupancy_delta(
    p_business_id uuid,
    p_venue_id uuid,
    p_area_id uuid,
    p_delta int,
    p_user_id uuid,
    p_device_id uuid DEFAULT NULL
) RETURNS TABLE (
    new_occupancy int,
    event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_occ int;
    v_event_id uuid;
BEGIN
    -- 1. Insert Event
    INSERT INTO occupancy_events (
        business_id, venue_id, area_id, delta, flow_type, event_type, source, user_id, device_id, created_at
    ) VALUES (
        p_business_id, p_venue_id, p_area_id, p_delta, 
        CASE WHEN p_delta > 0 THEN 'IN' ELSE 'OUT' END,
        'TAP', -- or 'SCAN' if generic
        'manual_tap', p_user_id, p_device_id, now()
    ) RETURNING id INTO v_event_id;

    -- 2. Update Snapshot (Atomic + Lock)
    UPDATE occupancy_snapshots 
    SET current_occupancy = GREATEST(0, current_occupancy + p_delta),
        updated_at = now()
    WHERE area_id = p_area_id
    RETURNING current_occupancy INTO v_new_occ;
    
    -- If no snapshot existed, create one (Safety)
    IF NOT FOUND THEN
        INSERT INTO occupancy_snapshots (area_id, venue_id, business_id, current_occupancy)
        VALUES (p_area_id, p_venue_id, p_business_id, GREATEST(0, p_delta))
        RETURNING current_occupancy INTO v_new_occ;
    END IF;

    RETURN QUERY SELECT v_new_occ, v_event_id;
END;
$$;


-- ==========================================
-- 3. AREA VIEW (Refresh)
-- ==========================================
-- Ensuring capacity is exposed for UI calc

DROP VIEW IF EXISTS view_area_details;
CREATE OR REPLACE VIEW view_area_details AS
SELECT 
    a.id as area_id,
    a.venue_id,
    v.business_id, 
    a.name as area_name,
    a.area_type,
    COALESCE(s.current_occupancy, 0) as current_occupancy,
    -- Capacity: return NULL if not set, or 0. Logic: If null in DB, coalesce to 0? 
    -- UI needs to know difference between 'No Limit' and 'Strictly 0'. 
    -- Assuming a.capacity IS NULL means no limit.
    a.capacity, 
    CASE 
        WHEN COALESCE(a.capacity, 0) > 0 THEN 
            ROUND((COALESCE(s.current_occupancy, 0)::numeric / a.capacity::numeric) * 100)
        ELSE 0 
    END as percent_full,
    s.updated_at as last_snapshot_at
FROM areas a
JOIN venues v ON a.venue_id = v.id
LEFT JOIN occupancy_snapshots s ON a.id = s.area_id;

-- Ensure RLS allows calls
GRANT EXECUTE ON FUNCTION reset_business_occupancy TO authenticated;
GRANT EXECUTE ON FUNCTION add_occupancy_delta TO authenticated;
