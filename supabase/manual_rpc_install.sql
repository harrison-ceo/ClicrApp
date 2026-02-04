-- COPY THIS SQL AND RUN IT IN YOUR SUPABASE DASHBOARD SQL EDITOR (https://supabase.com/dashboard)
-- This manually creates the critical RPC function required for Live Occupancy.

-- 0. Ensure Event Log Table Exists
CREATE TABLE IF NOT EXISTS occupancy_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    area_id uuid,
    device_id uuid,
    user_id uuid, -- Optional if we want to track user
    timestamp timestamptz DEFAULT now(),
    delta int NOT NULL,
    flow_type text, -- IN/OUT/RESET
    event_type text, -- clicker/manual/auto
    session_id text
);

CREATE INDEX IF NOT EXISTS idx_occupancy_events_venue ON occupancy_events(venue_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_events_area ON occupancy_events(area_id);

-- 1. Ensure Snapshot Table Exists
CREATE TABLE IF NOT EXISTS occupancy_snapshots (
    area_id uuid PRIMARY KEY,
    business_id uuid NOT NULL, -- Logical Tenant
    venue_id uuid NOT NULL,
    current_occupancy int DEFAULT 0,
    last_event_id uuid,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_area_snap UNIQUE(area_id)
);

ALTER TABLE occupancy_snapshots ENABLE ROW LEVEL SECURITY;

-- 2. Create the RPC function (add_occupancy_delta)
CREATE OR REPLACE FUNCTION add_occupancy_delta(
    p_business_id uuid,
    p_venue_id uuid,
    p_area_id uuid,
    p_device_id text,
    p_delta int,
    p_source text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_event_id uuid;
    v_current_occ int;
    v_new_occ int;
    v_snap_exists boolean;
BEGIN
    -- 1. Insert the event (immutable log)
    INSERT INTO occupancy_events (
        business_id, venue_id, area_id, device_id, 
        timestamp, delta, event_type, flow_type
    ) VALUES (
        p_business_id, p_venue_id, p_area_id, p_device_id::uuid,
        now(), p_delta, p_source, 
        CASE WHEN p_delta > 0 THEN 'IN' ELSE 'OUT' END
    ) RETURNING id INTO v_new_event_id;

    -- 2. Upsert Snapshot (Authoritative State)
    LOOP
        -- Try Update first
        UPDATE occupancy_snapshots 
        SET 
            current_occupancy = GREATEST(0, current_occupancy + p_delta),
            last_event_id = v_new_event_id,
            updated_at = now()
        WHERE area_id = p_area_id
        RETURNING current_occupancy INTO v_new_occ;
        
        IF FOUND THEN
            EXIT;
        END IF;

        -- Insert if missing (Self-Healing)
        BEGIN
            INSERT INTO occupancy_snapshots (business_id, venue_id, area_id, current_occupancy, last_event_id, updated_at)
            VALUES (p_business_id, p_venue_id, p_area_id, GREATEST(0, p_delta), v_new_event_id, now())
            RETURNING current_occupancy INTO v_new_occ;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            -- Retry loop if concurrent insert happened
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'event_id', v_new_event_id,
        'current_occupancy', v_new_occ
    );
END;
$$;
