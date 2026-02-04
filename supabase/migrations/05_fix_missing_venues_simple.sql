-- SIMPLIFIED FIX FOR ORPHAN DATA
-- Run these one block at a time if the complex query fails.

-- 1. Create a "Rescue Business" for anyone without a business
-- (Change the uuid below to a real one if you prefer, or let it auto-generate)
DO $$
DECLARE
    rec RECORD;
    new_biz_id UUID;
BEGIN
    FOR rec IN SELECT * FROM profiles WHERE business_id IS NULL LOOP
        -- Create Business
        INSERT INTO businesses (name) VALUES (COALESCE(rec.full_name, 'User') || '''s Business') RETURNING id INTO new_biz_id;
        
        -- Update Profile
        UPDATE profiles SET business_id = new_biz_id, role = 'OWNER' WHERE id = rec.id;
        
        -- Create Venue
        INSERT INTO venues (business_id, name, total_capacity, status) VALUES (new_biz_id, 'Main Venue', 500, 'ACTIVE');
    END LOOP;
END $$;

-- 2. Fix Businesses with NO Venues (for existing businesses)
INSERT INTO venues (business_id, name, total_capacity, status)
SELECT id, 'Main Venue', 500, 'ACTIVE'
FROM businesses 
WHERE id NOT IN (SELECT distinct business_id FROM venues);

-- 3. Fix Venues with NO Areas
INSERT INTO areas (venue_id, name, capacity)
SELECT id, 'General Admission', 500
FROM venues
WHERE id NOT IN (SELECT distinct venue_id FROM areas);
