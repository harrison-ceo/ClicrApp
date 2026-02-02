-- Relax constraints to allow legacy ID strings (e.g. 'ven_001')
-- Use this migration to fix invalid input syntax for type uuid

-- 1. Occupancy Events
ALTER TABLE occupancy_events ALTER COLUMN business_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN venue_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN area_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN device_id TYPE text;

ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_business_id_fkey;
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_venue_id_fkey;
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_area_id_fkey;
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_device_id_fkey;

-- 2. Scan Events
ALTER TABLE scan_events ALTER COLUMN venue_id TYPE text;
ALTER TABLE scan_events DROP CONSTRAINT IF EXISTS scan_events_venue_id_fkey;

-- 3. Scan Logs (if used)
ALTER TABLE scan_logs ALTER COLUMN business_id TYPE text;
ALTER TABLE scan_logs ALTER COLUMN venue_id TYPE text;
ALTER TABLE scan_logs ALTER COLUMN device_id TYPE text;

ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_business_id_fkey;
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_venue_id_fkey;
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_device_id_fkey;
