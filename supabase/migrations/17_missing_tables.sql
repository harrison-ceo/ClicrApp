
-- 17_missing_tables.sql

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    role text DEFAULT 'viewer',
    business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Occupancy Events (Log)
CREATE TABLE IF NOT EXISTS public.occupancy_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id text, -- stored as text in sync logic, but ideally uuid
    venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
    area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
    session_id text, -- clicr_id or device_id
    delta int NOT NULL,
    flow_type text,
    event_type text,
    timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- 3. Scan Events (Log)
CREATE TABLE IF NOT EXISTS public.scan_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id text,
    venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
    scan_result text,
    age int,
    gender text,
    zip_code text,
    first_name text,
    last_name text,
    dob text,
    id_number text,
    issuing_state text,
    city text,
    address_street text,
    timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupancy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can see themselves
CREATE POLICY policy_profiles_view_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY policy_profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Events: Viewable by business members
CREATE POLICY policy_occupancy_events_view ON public.occupancy_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_id::text = occupancy_events.business_id AND user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM public.businesses WHERE id::text = occupancy_events.business_id AND created_by_user_id = auth.uid())
);

CREATE POLICY policy_scan_events_view ON public.scan_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_id::text = scan_events.business_id AND user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.businesses WHERE id::text = scan_events.business_id AND created_by_user_id = auth.uid())
);

-- Allow insert by anyone authenticated (or restricted to device roles later)
CREATE POLICY policy_occupancy_events_insert ON public.occupancy_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY policy_scan_events_insert ON public.scan_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
