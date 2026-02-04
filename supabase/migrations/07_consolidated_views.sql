-- CONSOLIDATED VIEWS
-- Run this script to create "Master Views" in your Supabase Dashboard.
-- These look and act like tables but pull data from all over your database into one simple place.

-- VIEW 1: OPERATIONAL MASTER VIEW
-- Shows: Business -> Venue -> Area -> Device Count
CREATE OR REPLACE VIEW view_master_operations AS
SELECT
    b.name AS business_name,
    b.timezone AS business_timezone,
    
    -- Venue Details
    v.name AS venue_name,
    v.timezone AS venue_timezone,
    v.total_capacity AS venue_capacity,
    v.status AS venue_status,
    
    -- Area Details
    a.name AS area_name,
    a.capacity AS area_capacity,
    
    -- Device Counts (Calculated)
    (SELECT COUNT(*) FROM devices d WHERE d.area_id = a.id) AS device_count,
    
    -- Helper IDs
    b.id AS business_id,
    v.id AS venue_id,
    a.id AS area_id

FROM businesses b
LEFT JOIN venues v ON v.business_id = b.id
LEFT JOIN areas a ON a.venue_id = v.id
ORDER BY b.name, v.name, a.name;


-- VIEW 2: STAFFING MASTER VIEW
-- Shows: Business -> Staff Members -> Roles
CREATE OR REPLACE VIEW view_master_staffing AS
SELECT
    b.name AS business_name,
    p.full_name,
    p.email,
    p.role,
    p.created_at AS joined_at,
    b.id AS business_id,
    p.id AS user_id
FROM businesses b
JOIN profiles p ON p.business_id = b.id
ORDER BY b.name, p.role, p.email;
