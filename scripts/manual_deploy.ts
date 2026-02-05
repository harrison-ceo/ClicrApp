
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase URL or Service Key");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log("Starting Migration...");

    const sql = `
-- 20260205000000_fix_totals_end_to_end.sql

DELETE FROM occupancy_events WHERE business_id IS NULL OR venue_id IS NULL OR area_id IS NULL;

-- ALTER TABLE occupancy_events 
-- ALTER COLUMN business_id SET NOT NULL,
-- ALTER COLUMN venue_id SET NOT NULL,
-- ALTER COLUMN area_id SET NOT NULL; 
-- Commenting out strict alter just in case, relying on constraints via code + best effort

CREATE OR REPLACE FUNCTION get_traffic_totals_v3(
    p_business_id uuid,
    p_venue_id uuid DEFAULT NULL,
    p_area_id uuid DEFAULT NULL,
    p_start_ts timestamptz DEFAULT now() - interval '24 hours',
    p_end_ts timestamptz DEFAULT now()
) RETURNS TABLE (
    total_in bigint,
    total_out bigint,
    net_delta bigint,
    event_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as total_out,
        COALESCE(SUM(delta), 0) as net_delta,
        COUNT(*) as event_count
    FROM occupancy_events oe
    WHERE oe.business_id = p_business_id
    AND (p_venue_id IS NULL OR oe.venue_id = p_venue_id)
    AND (p_area_id IS NULL OR oe.area_id = p_area_id)
    AND oe.created_at >= p_start_ts
    AND oe.created_at <= p_end_ts;
END;
$$;

GRANT EXECUTE ON FUNCTION get_traffic_totals_v3 TO authenticated;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON occupancy_events;
CREATE POLICY "Enable read access for authenticated users" ON occupancy_events FOR SELECT TO authenticated USING (true);
    `;

    // Execute via RPC
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("RPC Execution Failed:", error);
    } else {
        console.log("Migration executed successfully via exec_sql RPC.");
    }
}

runMigration().catch(console.error);
