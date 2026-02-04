-- 09_fix_auth_architecture.sql

-- 1. Create app_errors table for robust logging
CREATE TABLE IF NOT EXISTS app_errors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid,
    business_id uuid,
    error_message text,
    context text, -- e.g. 'onboarding_step_1'
    created_at timestamptz DEFAULT now()
);

-- 2. Create business_members table (Multi-tenancy foundation)
CREATE TABLE IF NOT EXISTS business_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role DEFAULT 'STAFF',
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(business_id, user_id)
);

-- 3. Onboarding Progress Tracking (Persistent)
CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id),
    current_step text DEFAULT 'START',
    completed boolean DEFAULT false,
    updated_at timestamptz DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- app_errors: Users can insert their own errors (for debugging), Admins view all
CREATE POLICY "Users can insert errors" ON app_errors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all errors" ON app_errors FOR SELECT USING (true); -- Simplify for now, or restrict to system admins

-- business_members: Users can view their own memberships
CREATE POLICY "View own memberships" ON business_members 
    FOR SELECT USING (user_id = auth.uid());

-- businesses: Users can view businesses they are members of
CREATE POLICY "View own businesses" ON businesses 
    FOR SELECT USING (
        id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid())
    );

-- profiles: Users can view their own profile
CREATE POLICY "View own profile" ON profiles 
    FOR SELECT USING (id = auth.uid());

-- profiles: Allow users to update their own profile
CREATE POLICY "Update own profile" ON profiles 
    FOR UPDATE USING (id = auth.uid());

-- onboarding_progress: Users manage their own progress
CREATE POLICY "Manage own onboarding" ON onboarding_progress 
    FOR ALL USING (user_id = auth.uid());

-- 6. Backfill / Migration (If needed)
-- If we have existing profiles with business_id, migrate them to business_members
DO $$
BEGIN
    INSERT INTO business_members (business_id, user_id, role, is_default)
    SELECT business_id, id, role, true
    FROM profiles
    WHERE business_id IS NOT NULL
    ON CONFLICT (business_id, user_id) DO NOTHING;
END $$;
