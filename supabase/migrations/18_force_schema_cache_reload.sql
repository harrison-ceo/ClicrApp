
-- 18_force_schema_cache_reload.sql
-- This migration ensures the onboarding_progress table has the correct schema and forces a cache reload.

-- Check if payload column exists, add if not (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_progress' AND column_name='payload') THEN
        ALTER TABLE public.onboarding_progress ADD COLUMN payload jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
