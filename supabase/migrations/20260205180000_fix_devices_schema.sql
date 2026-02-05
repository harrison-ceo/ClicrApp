
-- 20260205180000_fix_devices_schema.sql

-- 1. Add status column if missing
ALTER TABLE devices ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';

-- 2. Add direction_mode if missing (redundant safety)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS direction_mode text DEFAULT 'bidirectional';

-- 3. Ensure venue_id and area_id are nullable for Unassigned devices
ALTER TABLE devices ALTER COLUMN venue_id DROP NOT NULL;
ALTER TABLE devices ALTER COLUMN area_id DROP NOT NULL;

-- 4. Ensure RLS allows Insert for Members
DROP POLICY IF EXISTS "Enable insert for business members" ON devices;
CREATE POLICY "Enable insert for business members" ON devices
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_members
            WHERE business_members.user_id = auth.uid()
            AND business_members.business_id = devices.business_id
        )
    );

-- 5. Ensure RLS allows Select for Members
DROP POLICY IF EXISTS "Enable select for business members" ON devices;
CREATE POLICY "Enable select for business members" ON devices
    FOR SELECT
    USING (
         EXISTS (
            SELECT 1 FROM business_members
            WHERE business_members.user_id = auth.uid()
            AND business_members.business_id = devices.business_id
        )
    );

-- 6. Reload constraint/schema cache
NOTIFY pgrst, 'reload config';
