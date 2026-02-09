
-- Create onboarding_progress table
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  current_step int NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  payload jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own progress
DROP POLICY IF EXISTS "Users can manage their own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users can manage their own onboarding progress"
  ON public.onboarding_progress
  FOR ALL
  USING (auth.uid() = user_id);

-- Ensure businesses table has created_by_user_id
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'created_by_user_id') THEN
        ALTER TABLE public.businesses ADD COLUMN created_by_user_id uuid REFERENCES auth.users(id);
        
        -- Backfill existing businesses (best effort: pick an owner)
        UPDATE public.businesses b
        SET created_by_user_id = (
            SELECT user_id FROM public.business_members bm 
            WHERE bm.business_id = b.id 
            ORDER BY created_at ASC 
            LIMIT 1
        );
    END IF;
END $$;

-- businesses RLS for creation
DROP POLICY IF EXISTS "Users can insert businesses they create" ON public.businesses;
CREATE POLICY "Users can insert businesses they create"
ON public.businesses
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

-- Business Members creation policy
DROP POLICY IF EXISTS "Users can insert their own membership for businesses they created" ON public.business_members;
CREATE POLICY "Users can insert their own membership for businesses they created"
ON public.business_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Ensure devices table has direction_mode
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'direction_mode') THEN
        ALTER TABLE public.devices ADD COLUMN direction_mode text NOT NULL DEFAULT 'bidirectional';
    END IF;
END $$;
