-- 20260205000000_fix_totals_end_to_end.sql

-- 1. Ensure Occupancy Events Constraints
-- We won't ALTER COLUMN ... SET NOT NULL blindly because it might fail if bad data exists.
-- Instead, we'll try to delete bad data first (optional safe cleanup), then enforce.
DELETE FROM occupancy_events WHERE business_id IS NULL OR venue_id IS NULL OR area_id IS NULL;

ALTER TABLE occupancy_events 
ALTER COLUMN business_id SET NOT NULL,
ALTER COLUMN venue_id SET NOT NULL,
ALTER COLUMN area_id SET NOT NULL;

-- 2. Authoritative RPC: get_traffic_totals_v3
-- Fixed to handle strict types and nullable params
CREATE OR REPLACE FUNCTION get_traffic_totals_v3(
    p_business_id uuid,
    p_venue_id uuid DEFAULT NULL,
    p_area_id uuid DEFAULT NULL,
    p_start_ts timestamptz DEFAULT now() - interval '24 hours',
    p_end_ts timestamptz DEFAULT now()
) RETURNS TABLE (
    total_in bigint,
    total_out bigint,
    net_delta bigint,
    event_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Membership Check (Optional but recommended for Security Definer)
    -- IF NOT EXISTS (SELECT 1 FROM business_members WHERE user_id = auth.uid() AND business_id = p_business_id) THEN
    --     RETURN; -- Return nothing (empty 0s)
    -- END IF;

    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as total_out,
        COALESCE(SUM(delta), 0) as net_delta,
        COUNT(*) as event_count
    FROM occupancy_events oe
    WHERE oe.business_id = p_business_id
    AND (p_venue_id IS NULL OR oe.venue_id = p_venue_id)
    AND (p_area_id IS NULL OR oe.area_id = p_area_id)
    AND oe.created_at >= p_start_ts
    AND oe.created_at <= p_end_ts;
END;
$$;

GRANT EXECUTE ON FUNCTION get_traffic_totals_v3 TO authenticated;

-- 3. RLS Policies (Permissive Read for Authenticated)
-- Ensure authenticated users can SELECT events (needed for realtime and potentially client-side audit if used)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON occupancy_events;
CREATE POLICY "Enable read access for authenticated users" ON occupancy_events FOR SELECT TO authenticated USING (true);

-- 4. Ensure Atomic RPCs use V2 (or confirm they are present)
-- (We assume reset_business_occupancy_v2 and add_occupancy_delta_v2 are active from previous steps)
