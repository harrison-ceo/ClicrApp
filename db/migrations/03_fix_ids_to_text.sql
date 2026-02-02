-- 1. Drop strict foreign key constraints FIRST (to allow type changes)
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_business_id_fkey;
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_venue_id_fkey;
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_area_id_fkey;
ALTER TABLE occupancy_events DROP CONSTRAINT IF EXISTS occupancy_events_device_id_fkey;

ALTER TABLE scan_events DROP CONSTRAINT IF EXISTS scan_events_venue_id_fkey;

ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_business_id_fkey;
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_venue_id_fkey;
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_device_id_fkey;

ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_business_id_fkey;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_venue_id_fkey;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_area_id_fkey;

-- 2. Relax constraints to allow legacy ID strings (e.g. 'ven_001')
ALTER TABLE occupancy_events ALTER COLUMN business_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN venue_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN area_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN device_id TYPE text;
ALTER TABLE occupancy_events ALTER COLUMN session_id TYPE text;

ALTER TABLE scan_events ALTER COLUMN venue_id TYPE text;

ALTER TABLE scan_logs ALTER COLUMN business_id TYPE text;
ALTER TABLE scan_logs ALTER COLUMN venue_id TYPE text;
ALTER TABLE scan_logs ALTER COLUMN device_id TYPE text;

ALTER TABLE devices ALTER COLUMN business_id TYPE text;
ALTER TABLE devices ALTER COLUMN venue_id TYPE text;
ALTER TABLE devices ALTER COLUMN area_id TYPE text;
