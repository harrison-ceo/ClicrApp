-- Ensure the RPC function exists with the exact requested signature and logic
-- This wraps the existing process_occupancy_event or re-defines it to be safe.

CREATE OR REPLACE FUNCTION add_occupancy_delta(
  p_business_id uuid,
  p_venue_id uuid,
  p_area_id uuid,
  p_device_id uuid, -- Clicr ID
  p_delta int,
  p_source text -- e.g. "clicker", "manual"
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Call the robust processing function (defined in 15_strict_occupancy.sql)
  -- We map p_source to event_type
  v_result := process_occupancy_event(
    p_business_id,
    p_venue_id,
    p_area_id,
    p_device_id::text, -- Cast to text as process_occupancy_event accepts text/uuid mixed
    auth.uid(),        -- User ID from context
    p_delta,
    CASE WHEN p_delta > 0 THEN 'IN' ELSE 'OUT' END, -- flow_type
    p_source,          -- event_type
    NULL               -- session_id (optional)
  );

  RETURN v_result;
END;
$$;
