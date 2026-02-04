-- 10_implement_scanning_system.sql

-- 1. Create Identities Table (Centralized Identity Store)
CREATE TABLE IF NOT EXISTS identities (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id uuid REFERENCES businesses(id) NOT NULL,
    identity_token_hash text NOT NULL, -- SHA256(issuing_region + id_number + dob + SALT)
    id_last4 text,
    issuing_region text,
    dob_year int,
    initials text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(business_id, identity_token_hash)
);

-- 2. Create Ban Reason Codes (Seeded)
CREATE TABLE IF NOT EXISTS ban_reason_codes (
    code text PRIMARY KEY,
    label text NOT NULL,
    active boolean DEFAULT true
);

INSERT INTO ban_reason_codes (code, label) VALUES
('AGGRESSIVE', 'Aggressive Behavior'),
('THEFT', 'Theft / Stealing'),
('HARASSMENT', 'Harassment'),
('DAMAGE', 'Property Damage'),
('VIP_VIOLATION', 'VIP Area Violation'),
('REPEAT_OFFENDER', 'Repeat Offender'),
('OTHER', 'Other (See Notes)')
ON CONFLICT (code) DO NOTHING;

-- 3. Re-create Bans Table (Enhanced)
-- We drop the old one if it exists to ensure schema matches exactly
DROP TABLE IF EXISTS bans;
CREATE TABLE bans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id uuid REFERENCES businesses(id) NOT NULL,
    venue_id uuid REFERENCES venues(id), -- NULL = Business-wide ban
    identity_token_hash text NOT NULL,
    reason_code text REFERENCES ban_reason_codes(code),
    notes text,
    active boolean DEFAULT true,
    start_at timestamptz DEFAULT now(),
    end_at timestamptz, -- NULL = Permanent
    created_by uuid REFERENCES auth.users(id), -- Changed from profiles(id) to auth.users(id) for cleaner RLS usually, but let's stick to auth.uid()
    created_at timestamptz DEFAULT now(),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES auth.users(id)
);

-- 4. Create ID Scans Table (The Core Log)
-- Replacing scan_logs with strict id_scans structure
DROP TABLE IF EXISTS scan_logs; 
CREATE TABLE id_scans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id uuid REFERENCES businesses(id) NOT NULL,
    venue_id uuid REFERENCES venues(id),
    area_id uuid REFERENCES areas(id),
    device_id uuid REFERENCES devices(id),
    device_session_id text,
    user_id uuid REFERENCES auth.users(id),
    identity_token_hash text NOT NULL,
    outcome text NOT NULL, -- 'ACCEPTED', 'DENIED'
    denial_reason text, -- 'UNDERAGE', 'BANNED', 'EXPIRED', etc.
    scanned_at timestamptz DEFAULT now(),
    metadata_json jsonb DEFAULT '{}'::jsonb,
    parse_version text DEFAULT '1.0'
);

-- 5. Indexes for Performance
CREATE INDEX idx_identities_hash ON identities(business_id, identity_token_hash);
CREATE INDEX idx_bans_lookup ON bans(business_id, identity_token_hash) WHERE active = true;
CREATE INDEX idx_id_scans_history ON id_scans(business_id, identity_token_hash, scanned_at DESC);
CREATE INDEX idx_id_scans_venue_time ON id_scans(venue_id, scanned_at DESC);

-- 6. RLS Policies

-- Identities
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own business identities" ON identities 
    FOR SELECT USING (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));

-- Ban Reasons (Public/Shared)
ALTER TABLE ban_reason_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read ban reasons" ON ban_reason_codes FOR SELECT USING (true);

-- Bans
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own business bans" ON bans 
    FOR SELECT USING (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));
CREATE POLICY "Manage own business bans" ON bans 
    FOR ALL USING (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));

-- ID Scans
ALTER TABLE id_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own business scans" ON id_scans 
    FOR SELECT USING (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));
CREATE POLICY "Insert own business scans" ON id_scans 
    FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));

-- Audit Logs (Structure Update)
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id uuid REFERENCES businesses(id) NOT NULL,
    actor_user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    before_json jsonb,
    after_json jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own business audit logs" ON audit_logs 
    FOR SELECT USING (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));
CREATE POLICY "Insert audit logs" ON audit_logs 
    FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));
