-- FIX MISSING VENUES AND AREAS
-- This script ensures every Profile belongs to a Business.
-- It ensures every Business has at least one Venue.
-- It ensures every Venue has at least one Area.

-- 1. Create Businesses for Orphans
-- Create a business for any profile that has no business_id or invalid business_id
-- We assume 'OWNER' role for these recoveries.

WITH new_businesses AS (
  INSERT INTO businesses (name)
  SELECT 
    CASE 
      WHEN full_name IS NOT NULL AND full_name != '' THEN full_name || '''s Organization'
      ELSE split_part(email, '@', 1) || '''s Organization'
    END
  FROM profiles
  WHERE business_id IS NULL
  RETURNING id, name
)
UPDATE profiles
SET business_id = nb.id, role = 'OWNER'
FROM new_businesses nb
WHERE profiles.business_id IS NULL 
  AND (
    (profiles.full_name IS NOT NULL AND profiles.full_name || '''s Organization' = nb.name)
    OR
    (split_part(profiles.email, '@', 1) || '''s Organization' = nb.name)
  );

-- 2. Create Default Venue for Businesses passing "No Venue" check
INSERT INTO venues (business_id, name, total_capacity, status)
SELECT id, 'Main Venue', 500, 'ACTIVE'
FROM businesses
WHERE id NOT IN (SELECT distinct business_id FROM venues);

-- 3. Create Default Area for Venues passing "No Area" check
INSERT INTO areas (venue_id, name, capacity)
SELECT id, 'General Admission', 500
FROM venues
WHERE id NOT IN (SELECT distinct venue_id FROM areas);

-- Verify
SELECT 
    b.name as business, 
    v.name as venue, 
    a.name as area 
FROM businesses b
JOIN venues v ON v.business_id = b.id
JOIN areas a ON a.venue_id = v.id;
