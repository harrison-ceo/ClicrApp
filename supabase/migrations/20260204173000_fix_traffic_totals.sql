-- 22_p0_traffic_fix.sql
-- Master script to fix Traffic Totals (RPC + RLS)

-- 1. Ensure `exec_sql` exists for future migrations via API
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql_query;
END;
$$;

-- 2. Schema Fixes (occupancy_events)
-- Ensure created_at exists and is populated (Fix for legacy tables)
CREATE TABLE IF NOT EXISTS occupancy_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id uuid NOT NULL,
    venue_id uuid,
    area_id uuid,
    device_id uuid,
    user_id uuid,
    delta int,
    flow_type text,
    event_type text,
    session_id text,
    created_at timestamptz DEFAULT now(),
    timestamp timestamptz DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'occupancy_events' AND column_name = 'created_at') THEN
        ALTER TABLE occupancy_events ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
END $$;

UPDATE occupancy_events SET created_at = timestamp WHERE created_at IS NULL;
ALTER TABLE occupancy_events ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (Clean Slate)
-- We drop existing policies to avoid conflicts and ensure permissive authenticated access
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow read authenticated" ON occupancy_events;
    DROP POLICY IF EXISTS "Allow insert authenticated" ON occupancy_events;
    DROP POLICY IF EXISTS "Enable read access for all users" ON occupancy_events;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON occupancy_events;

    -- Create Permissive Policies
    CREATE POLICY "Allow read authenticated" ON occupancy_events FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Allow insert authenticated" ON occupancy_events FOR INSERT TO authenticated WITH CHECK (true);

    -- Snapshot policies
    DROP POLICY IF EXISTS "Allow read authenticated" ON occupancy_snapshots;
    CREATE POLICY "Allow read authenticated" ON occupancy_snapshots FOR SELECT TO authenticated USING (true);
END $$;

-- 4. Traffic Totals RPC (Authoritative Source)
-- Using created_at for filtering and RETURNS TABLE for API compatibility
DROP FUNCTION IF EXISTS get_traffic_totals(uuid, uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_traffic_totals(
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
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN oe.delta > 0 THEN oe.delta ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN oe.delta < 0 THEN ABS(oe.delta) ELSE 0 END), 0) as total_out,
        COALESCE(SUM(oe.delta), 0) as net_delta,
        COUNT(*) as event_count
    FROM occupancy_events oe
    WHERE oe.business_id = p_business_id
    AND (p_venue_id IS NULL OR oe.venue_id = p_venue_id)
    AND (p_area_id IS NULL OR oe.area_id = p_area_id)
    -- CRITICAL FIX: Filter by created_at, matching the event recording logic
    AND oe.created_at >= p_start_ts
    AND oe.created_at <= p_end_ts;
END;
$$;
