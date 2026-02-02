-- Add PII columns to scan_events to support Guest Directory features
-- Also relax id_hash constraint since we aren't hashing yet

ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS issuing_state text;
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE scan_events ADD COLUMN IF NOT EXISTS address_street text;

-- Relax mandatory hash
ALTER TABLE scan_events ALTER COLUMN id_hash DROP NOT NULL;
