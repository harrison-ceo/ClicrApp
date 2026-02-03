-- 11_fix_devices_rls.sql (Revised with Type Casts)

-- 1. Enable RLS on devices (safe to run multiple times)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "View own business devices" ON devices;
DROP POLICY IF EXISTS "Manage own business devices" ON devices;
DROP POLICY IF EXISTS "Update own business devices" ON devices;
DROP POLICY IF EXISTS "Delete own business devices" ON devices;
DROP POLICY IF EXISTS "Users can view devices for their business" ON devices;
DROP POLICY IF EXISTS "Owners/Managers can insert devices" ON devices;

-- 3. View Policy
-- We cast to text to handle cases where business_id or profile IDs might be mixed types (UUID/Text) in the DB
CREATE POLICY "View own business devices" ON devices
  FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
    )
  );

-- 4. Insert Policy
CREATE POLICY "Manage own business devices" ON devices
  FOR INSERT
  WITH CHECK (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
      AND role::text IN ('OWNER', 'MANAGER', 'ADMIN', 'SUPERVISOR')
    )
  );

-- 5. Update Policy
CREATE POLICY "Update own business devices" ON devices
  FOR UPDATE
  USING (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
      AND role::text IN ('OWNER', 'MANAGER', 'ADMIN', 'SUPERVISOR')
    )
  );

-- 6. Delete Policy
CREATE POLICY "Delete own business devices" ON devices
  FOR DELETE
  USING (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
      AND role::text IN ('OWNER', 'MANAGER', 'ADMIN', 'SUPERVISOR')
    )
  );
