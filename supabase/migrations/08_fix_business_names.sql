-- FIX BUSINESS NAMES
-- This script updates the business names for users who were backfilled with generic defaults.
-- It attempts to use the most "Business-like" name available.

-- 1. Update Business Name from Onboarding actions if available (In a real scenario, this data might be lost if it failed to write)
-- OR
-- 2. Update Business Name based on the User's Email Domain (if it's not a generic provider)

UPDATE businesses
SET name = INITCAP(SPLIT_PART(p.email, '@', 2)) || ' Group'
FROM profiles p
WHERE businesses.id = p.business_id
  AND (businesses.name LIKE '%''s Business%' OR businesses.name = 'User''s Business') -- Only target the auto-generated ones
  AND SPLIT_PART(p.email, '@', 2) NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com');

-- 3. For generic emails (gmail, etc.), we can't guess the LLC name. 
-- You might have to manually update those specific rows in the Supabase Table Editor 
-- or ask those users to update their profile settings.

-- Verification Query: See what they look like now
SELECT id, name FROM businesses;
