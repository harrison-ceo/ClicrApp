-- 17_app_errors_and_soft_delete_fix.sql

-- 1. Create app_errors table
CREATE TABLE IF NOT EXISTS app_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  error_message text,
  context text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert errors" ON app_errors;
CREATE POLICY "Users can insert errors" ON app_errors 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. Add deleted_by to devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- 3. Fix Devices RLS for UPDATE (Soft Delete)
DROP POLICY IF EXISTS "Enable update for managers" ON devices;

CREATE POLICY "Enable update for managers" ON devices
FOR UPDATE TO authenticated
USING (
  business_id::text IN (
    SELECT business_id::text FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  business_id::text IN (
    SELECT business_id::text FROM profiles WHERE id = auth.uid()
  )
);
