-- 15_strict_occupancy_v2.sql

-- 1. Ensure Indexes for Performance and Uniqueness
CREATE INDEX IF NOT EXISTS idx_occupancy_snapshots_composite 
ON occupancy_snapshots(business_id, venue_id, area_id);

CREATE INDEX IF NOT EXISTS idx_occupancy_events_composite 
ON occupancy_events(business_id, venue_id, area_id, timestamp);

-- 2. Strict Row Locking Update Function (Explicit FOR UPDATE)
CREATE OR REPLACE FUNCTION process_occupancy_event(
  p_business_id uuid,
  p_venue_id uuid,
  p_area_id uuid,
  p_device_id text, -- Changed to TEXT to tolerate legacy IDs
  p_user_id uuid, 
  p_delta int,
  p_flow_type text,
  p_event_type text,
  p_session_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_event_id uuid;
  v_current_occ int;
  v_new_occ int;
  v_snap_exists boolean;
  v_safe_device_id uuid;
BEGIN
  -- Safe Cast Device ID
  BEGIN
    v_safe_device_id := p_device_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_safe_device_id := NULL;
  END;

  -- 1. Insert the event
  INSERT INTO occupancy_events (
    business_id, venue_id, area_id, device_id, 
    timestamp, flow_type, delta, event_type, session_id
  ) VALUES (
    p_business_id, p_venue_id, p_area_id, v_safe_device_id,
    now(), p_flow_type, p_delta, p_event_type, p_session_id
  ) RETURNING id INTO v_new_event_id;

  -- 2. Update Snapshot with Explicit Locking
  -- Loop to handle race condition where row is deleted/created concurrently (rare)
  LOOP
    -- Try to lock existing row
    SELECT TRUE, current_occupancy INTO v_snap_exists, v_current_occ
    FROM occupancy_snapshots 
    WHERE area_id = p_area_id
    FOR UPDATE; -- CRITICAL: Lock the row!

    IF v_snap_exists THEN
      -- Update existing
      v_new_occ := GREATEST(0, v_current_occ + p_delta);
      
      UPDATE occupancy_snapshots 
      SET 
        current_occupancy = v_new_occ,
        last_event_id = v_new_event_id,
        updated_at = now()
      WHERE area_id = p_area_id;
      
      EXIT; -- Done
    ELSE
      -- Insert new (if not exists)
      BEGIN
        INSERT INTO occupancy_snapshots (business_id, venue_id, area_id, current_occupancy, last_event_id, updated_at)
        VALUES (p_business_id, p_venue_id, p_area_id, GREATEST(0, p_delta), v_new_event_id, now())
        RETURNING current_occupancy INTO v_new_occ;
        
        EXIT; -- Done
      EXCEPTION WHEN unique_violation THEN
        -- Someone else created it just now, loop back and try updating
        CONTINUE;
      END;
    END IF;
  END LOOP;

  -- 3. Return the result
  RETURN jsonb_build_object(
    'event_id', v_new_event_id,
    'current_occupancy', v_new_occ
  );
END;
$$;

-- 3. Audit Logging Table for Resets (Requested Spec)
CREATE TABLE IF NOT EXISTS reset_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES businesses(id),
    venue_id uuid REFERENCES venues(id),
    area_id uuid REFERENCES areas(id),
    reset_by_user_id uuid, -- Link to profiles/auth
    previous_count int,
    timestamp timestamptz DEFAULT now()
);

-- 4. Explicit Reset Function
CREATE OR REPLACE FUNCTION reset_occupancy(
    p_business_id uuid,
    p_venue_id uuid,
    p_area_id uuid,
    p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_count int;
BEGIN
    -- Lock row
    SELECT current_occupancy INTO v_prev_count
    FROM occupancy_snapshots
    WHERE area_id = p_area_id
    FOR UPDATE;

    -- Update
    UPDATE occupancy_snapshots
    SET current_occupancy = 0,
        updated_at = now()
    WHERE area_id = p_area_id;

    -- Log
    INSERT INTO reset_audit_logs (business_id, venue_id, area_id, reset_by_user_id, previous_count)
    VALUES (p_business_id, p_venue_id, p_area_id, p_user_id, v_prev_count);
    
    -- Insert Event Log for history
    INSERT INTO occupancy_events (
        business_id, venue_id, area_id, device_id, 
        timestamp, flow_type, delta, event_type, session_id
    ) VALUES (
        p_business_id, p_venue_id, p_area_id, NULL,
        now(), 'RESET', -v_prev_count, 'MANUAL_RESET', NULL
    );

    RETURN jsonb_build_object('success', true, 'previous_count', v_prev_count);
END;
$$;
