-- MASTER REPAIR SCRIPT
-- This script does two things:
-- 1. It adds missing columns to your database that the App expects (Fixes the "column does not exist" error).
-- 2. It populates the missing Venues and Areas for your users.

-- PART 1: UPDATE TABLE STRUCTURE
ALTER TABLE venues ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS capacity_enforcement_mode text DEFAULT 'WARN_ONLY';

ALTER TABLE areas ADD COLUMN IF NOT EXISTS area_type text DEFAULT 'MAIN';
ALTER TABLE areas ADD COLUMN IF NOT EXISTS counting_mode text DEFAULT 'MANUAL';
ALTER TABLE areas ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- PART 2: POPULATE MISSING DATA
DO $$
DECLARE
    rec RECORD;
    new_biz_id UUID;
BEGIN
    -- Loop through orphaned profiles (Profiles with no Business)
    FOR rec IN SELECT * FROM profiles WHERE business_id IS NULL LOOP
        
        -- Create Business
        INSERT INTO businesses (name) 
        VALUES (COALESCE(rec.full_name, 'User') || '''s Business') 
        RETURNING id INTO new_biz_id;
        
        -- Update Profile to link to this new Business
        UPDATE profiles SET business_id = new_biz_id, role = 'OWNER' WHERE id = rec.id;
        
        -- Create Default Venue
        INSERT INTO venues (business_id, name, total_capacity, status) 
        VALUES (new_biz_id, 'Main Venue', 500, 'ACTIVE');
        
    END LOOP;
END $$;

-- Fix Businesses that exist but have NO Venues
INSERT INTO venues (business_id, name, total_capacity, status)
SELECT id, 'Main Venue', 500, 'ACTIVE'
FROM businesses 
WHERE id NOT IN (SELECT distinct business_id FROM venues);

-- Fix Venues that exist but have NO Areas
INSERT INTO areas (venue_id, name, capacity)
SELECT id, 'General Admission', 500
FROM venues
WHERE id NOT IN (SELECT distinct venue_id FROM areas);
