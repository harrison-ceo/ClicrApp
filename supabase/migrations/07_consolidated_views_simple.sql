-- FIXED CONSOLIDATED VIEWS
-- Simplified syntax to avoid potential permission/schema issues in the previous attempt.

-- 1. DROP EXISTING IF THEY EXIST (To start clean)
DROP VIEW IF EXISTS view_master_operations;
DROP VIEW IF EXISTS view_master_staffing;

-- 2. CREATE OPERATIONAL MASTER VIEW
CREATE VIEW view_master_operations AS
SELECT
    b.name AS business_name,
    v.name AS venue_name,
    v.total_capacity AS venue_capacity,
    a.name AS area_name,
    a.capacity AS area_capacity,
    b.id AS business_id,
    v.id AS venue_id
FROM businesses b
LEFT JOIN venues v ON v.business_id = b.id
LEFT JOIN areas a ON a.venue_id = v.id;

-- 3. CREATE STAFFING MASTER VIEW
CREATE VIEW view_master_staffing AS
SELECT
    b.name AS business_name,
    p.email,
    p.role,
    b.id AS business_id
FROM businesses b
JOIN profiles p ON p.business_id = b.id;
