
-- 16_onboarding_robust_v2.sql

-- 1. Businesses
CREATE TABLE IF NOT EXISTS public.businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_by_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 2. Business Members
CREATE TABLE IF NOT EXISTS public.business_members (
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'owner',
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (business_id, user_id)
);

-- 3. Onboarding Progress
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
    current_step int NOT NULL DEFAULT 1,
    completed boolean NOT NULL DEFAULT false,
    payload jsonb DEFAULT '{}'::jsonb,
    updated_at timestamptz DEFAULT now()
);

-- 4. Venues
CREATE TABLE IF NOT EXISTS public.venues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    location_text text,
    capacity_max int,
    last_reset_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- 5. Areas
CREATE TABLE IF NOT EXISTS public.areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    capacity_max int,
    last_reset_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- 6. Devices (Clicrs)
CREATE TABLE IF NOT EXISTS public.devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
    area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    direction_mode text NOT NULL DEFAULT 'bidirectional',
    created_at timestamptz DEFAULT now()
);

-- 7. Occupancy Snapshots
CREATE TABLE IF NOT EXISTS public.occupancy_snapshots (
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
    area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE NOT NULL,
    current_occupancy int NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(business_id, venue_id, area_id)
);

-- Enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupancy_snapshots ENABLE ROW LEVEL SECURITY;

-- CLEANUP OLD POLICIES (to avoid conflicts)
DROP POLICY IF EXISTS "Insert businesses" ON public.businesses;
DROP POLICY IF EXISTS "Select businesses" ON public.businesses;
DROP POLICY IF EXISTS "Update businesses" ON public.businesses;
DROP POLICY IF EXISTS "Insert own membership" ON public.business_members;
DROP POLICY IF EXISTS "Select own membership" ON public.business_members;
DROP POLICY IF EXISTS "Manage own onboarding" ON public.onboarding_progress;
DROP POLICY IF EXISTS "Access venues via membership" ON public.venues;
DROP POLICY IF EXISTS "Access areas via membership" ON public.areas;
DROP POLICY IF EXISTS "Access devices via membership" ON public.devices;
DROP POLICY IF EXISTS "Access snapshots via membership" ON public.occupancy_snapshots;

-- RLS POLICIES (Snake Case Names - Safe)

-- Onboarding
CREATE POLICY policy_manage_own_onboarding ON public.onboarding_progress
    FOR ALL USING (auth.uid() = user_id);

-- Businesses
CREATE POLICY policy_insert_businesses ON public.businesses
    FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY policy_select_businesses ON public.businesses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.business_members WHERE business_id = id AND user_id = auth.uid())
    );

CREATE POLICY policy_update_businesses ON public.businesses
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.business_members WHERE business_id = id AND user_id = auth.uid())
    );

-- Business Members
CREATE POLICY policy_insert_own_membership ON public.business_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY policy_select_own_membership ON public.business_members
    FOR SELECT USING (auth.uid() = user_id);

-- Venues
CREATE POLICY policy_access_venues ON public.venues
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.business_members WHERE business_id = venues.business_id AND user_id = auth.uid())
    );

-- Areas
CREATE POLICY policy_access_areas ON public.areas
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.business_members WHERE business_id = areas.business_id AND user_id = auth.uid())
    );

-- Devices
CREATE POLICY policy_access_devices ON public.devices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.business_members WHERE business_id = devices.business_id AND user_id = auth.uid())
    );

-- Snapshots
CREATE POLICY policy_access_snapshots ON public.occupancy_snapshots
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.business_members WHERE business_id = occupancy_snapshots.business_id AND user_id = auth.uid())
    );

-- App Errors
CREATE TABLE IF NOT EXISTS public.app_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    business_id uuid,
    error_message text,
    context text,
    route text,
    stack text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Insert errors" ON public.app_errors;
DROP POLICY IF EXISTS policy_insert_errors ON public.app_errors;
CREATE POLICY policy_insert_errors ON public.app_errors FOR INSERT WITH CHECK (true);
