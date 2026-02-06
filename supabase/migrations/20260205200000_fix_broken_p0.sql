-- EMERGENCY FIX P0: RESTORE DATA FLOW AND COUNTS
-- 1. Fix RLS on business_members (The root cause of "Lost Data" and "Zero Counts")
-- 2. Fix RPC flow_type casting error (The root cause of "Click failing")
-- 3. Clean duplicates in snapshots (The root cause of "Blink to 0")

-- Transaction block removed for RPC execution compatibility

-- ==============================================================================
-- 1. RLS FIX (The Keyston)
-- ==============================================================================
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read business_members" ON business_members;
CREATE POLICY "Read business_members_emergency" ON business_members 
FOR SELECT USING (user_id = auth.uid());

-- Ensure other tables have correct RLS too
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read venues_emergency" ON venues;
CREATE POLICY "Read venues_emergency" ON venues FOR SELECT
USING (
  business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid())
);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read areas_emergency" ON areas;
CREATE POLICY "Read areas_emergency" ON areas FOR SELECT
USING (
  business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid())
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read devices_emergency" ON devices;
CREATE POLICY "Read devices_emergency" ON devices FOR SELECT
USING (
  business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 2. FIX RPC (Remove brittle Casting)
-- ==============================================================================

-- Make sure flow_type exists, just in case
DO $$ BEGIN
    CREATE TYPE flow_type AS ENUM ('IN', 'OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION apply_occupancy_delta(
    p_business_id uuid,
    p_venue_id uuid,
    p_area_id uuid,
    p_delta int,
    p_source text,
    p_device_id uuid DEFAULT NULL
)
RETURNS TABLE (new_occupancy int, event_id uuid, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_occ int;
    v_event_id uuid;
    v_updated_at timestamptz;
BEGIN
    -- 1. Security Check (Bypass RLS, but verify membership manually)
    IF NOT EXISTS (
        SELECT 1 FROM business_members 
        WHERE business_id = p_business_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access Denied: Not a member of business %', p_business_id;
    END IF;

    -- 2. Lock & Update Snapshot (Upsert)
    INSERT INTO occupancy_snapshots AS os (business_id, venue_id, area_id, current_occupancy, updated_at)
    VALUES (p_business_id, p_venue_id, p_area_id, GREATEST(0, p_delta), now())
    ON CONFLICT (area_id)
    DO UPDATE SET 
        current_occupancy = GREATEST(0, os.current_occupancy + p_delta),
        updated_at = now()
    RETURNING os.current_occupancy, os.updated_at INTO v_new_occ, v_updated_at;

    -- 3. Insert Event Log (Removed explicit ::flow_type cast for safety, let Postgres infer or store as text if column changed)
    INSERT INTO occupancy_events (business_id, venue_id, area_id, delta, source, device_id, flow_type, event_type)
    VALUES (
        p_business_id, 
        p_venue_id, 
        p_area_id, 
        p_delta, 
        p_source, 
        p_device_id,
        CASE WHEN p_delta >= 0 THEN 'IN' ELSE 'OUT' END, -- Removed ::flow_type cast
        CASE WHEN p_source = 'reset' THEN 'RESET' ELSE 'TAP' END
    )
    RETURNING id INTO v_event_id;

    -- 4. Return
    RETURN QUERY SELECT v_new_occ, v_event_id, v_updated_at;
END;
$$;


-- ==============================================================================
-- 3. CLEAN UP DUPLICATES (Snapshots)
-- ==============================================================================
-- If any area has multiple snapshots, keep the one with the highest ID (or updated_at)
DELETE FROM occupancy_snapshots a 
USING occupancy_snapshots b 
WHERE a.area_id = b.area_id AND a.updated_at < b.updated_at;

-- Ensure constraint exists
ALTER TABLE occupancy_snapshots DROP CONSTRAINT IF EXISTS occupancy_snapshots_pkey;
ALTER TABLE occupancy_snapshots ADD PRIMARY KEY (area_id);


-- Transaction block removed for RPC execution compatibility
