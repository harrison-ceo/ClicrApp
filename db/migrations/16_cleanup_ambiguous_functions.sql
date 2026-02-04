-- 16_cleanup_ambiguous_functions.sql

-- Resolve "Could not choose the best candidate function" error
-- The issue is due to overloaded function signatures (one taking UUID, one taking TEXT)

-- Drop the specific old overload that forced UUID for device_id
DROP FUNCTION IF EXISTS process_occupancy_event(uuid, uuid, uuid, uuid, uuid, int, text, text, text);

-- (Optional) If we want to be safe, we could drop ALL and recreate, but dropping the specific collision is safer to avoid downtime.
