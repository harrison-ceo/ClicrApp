-- 12_soft_delete_devices.sql
-- Add deleted_at column to devices for soft delete
ALTER TABLE devices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Update RLS policies to respect deleted_at
-- This requires dropping the previous policy and re-creating it with the check
DROP POLICY IF EXISTS "View own business devices" ON devices;

CREATE POLICY "View own business devices" ON devices
  FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM profiles
      WHERE id::text = auth.uid()::text
    )
    AND deleted_at IS NULL
  );
