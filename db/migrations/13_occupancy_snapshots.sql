-- 13_occupancy_snapshots.sql
-- Create a table to store the current occupancy state for each area

CREATE TABLE IF NOT EXISTS occupancy_snapshots (
  area_id uuid PRIMARY KEY REFERENCES areas(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) NOT NULL,
  venue_id uuid REFERENCES venues(id) NOT NULL,
  current_occupancy int DEFAULT 0,
  last_event_id uuid, -- Link to the last processed event for idempotency
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE occupancy_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- READ: Authenticated users can read snapshots for their business
CREATE POLICY "View own business snapshots" ON occupancy_snapshots
  FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
    )
  );

-- WRITE: Generally handled by server side functions, but if updated directly:
CREATE POLICY "Update own business snapshots" ON occupancy_snapshots
  FOR UPDATE
  USING (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
    )
  );

-- Function to handle event insertion and snapshot update atomically
CREATE OR REPLACE FUNCTION process_occupancy_event(
  p_business_id uuid,
  p_venue_id uuid,
  p_area_id uuid,
  p_device_id uuid,
  p_user_id uuid, -- Pass as UUID if possible, or string and cast inside if needed. API passes 'system' sometimes, need care.
  p_delta int,
  p_flow_type flow_type,
  p_event_type text,
  p_session_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to ensure consistency
AS $$
DECLARE
  v_new_event_id uuid;
  v_current_occ int;
  v_new_occ int;
BEGIN
  -- 1. Insert the event
  INSERT INTO occupancy_events (
    business_id, venue_id, area_id, device_id, 
    timestamp, flow_type, delta, event_type, session_id
  ) VALUES (
    p_business_id, p_venue_id, p_area_id, p_device_id,
    now(), p_flow_type, p_delta, p_event_type, p_session_id
  ) RETURNING id INTO v_new_event_id;

  -- 2. Upsert the snapshot
  -- We use ON CONFLICT to handle the first time an area has an event
  INSERT INTO occupancy_snapshots (business_id, venue_id, area_id, current_occupancy, last_event_id, updated_at)
  VALUES (p_business_id, p_venue_id, p_area_id, GREATEST(0, p_delta), v_new_event_id, now())
  ON CONFLICT (area_id) DO UPDATE SET
    current_occupancy = GREATEST(0, occupancy_snapshots.current_occupancy + p_delta),
    last_event_id = v_new_event_id,
    updated_at = now()
  RETURNING current_occupancy INTO v_new_occ;

  -- 3. Return the result
  RETURN jsonb_build_object(
    'event_id', v_new_event_id,
    'current_occupancy', v_new_occ
  );
END;
$$;
