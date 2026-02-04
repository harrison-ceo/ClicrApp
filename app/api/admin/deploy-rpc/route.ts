import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const sql = `
            -- 1. Ensure Table Exists and has RLS
            CREATE TABLE IF NOT EXISTS occupancy_snapshots (
                area_id uuid PRIMARY KEY,
                business_id uuid NOT NULL,
                venue_id uuid NOT NULL,
                current_occupancy int DEFAULT 0,
                last_event_id uuid,
                updated_at timestamptz DEFAULT now(),
                CONSTRAINT unique_area CURR_OFF_AREA UNIQUE(area_id)
            );
            
            ALTER TABLE occupancy_snapshots ENABLE ROW LEVEL SECURITY;

            -- 1b. App Errors Table
            CREATE TABLE IF NOT EXISTS app_errors (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                feature text,
                business_id uuid,
                venue_id uuid,
                area_id uuid,
                device_id uuid,
                error_message text,
                error_code text,
                created_at timestamptz DEFAULT now()
            );
            ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;

            -- 2. Create the RPC function (add_occupancy_delta)
            CREATE OR REPLACE FUNCTION add_occupancy_delta(
                p_business_id uuid,
                p_venue_id uuid,
                p_area_id uuid,
                p_device_id text,
                p_delta int,
                p_source text
            ) RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_new_event_id uuid;
                v_current_occ int;
                v_new_occ int;
            BEGIN
                -- 1. Insert the event
                INSERT INTO occupancy_events (
                    business_id, venue_id, area_id, device_id, 
                    timestamp, delta, event_type, flow_type
                ) VALUES (
                    p_business_id, p_venue_id, p_area_id, p_device_id::uuid,
                    now(), p_delta, p_source, 
                    CASE WHEN p_delta > 0 THEN 'IN' ELSE 'OUT' END
                ) RETURNING id INTO v_new_event_id;

                -- 2. Upsert Snapshot
                LOOP
                    -- Try Update
                    UPDATE occupancy_snapshots 
                    SET 
                        current_occupancy = GREATEST(0, current_occupancy + p_delta),
                        last_event_id = v_new_event_id,
                        updated_at = now()
                    WHERE area_id = p_area_id
                    RETURNING current_occupancy INTO v_new_occ;
                    
                    IF FOUND THEN
                        EXIT;
                    END IF;

                    -- Insert if missing
                    BEGIN
                        INSERT INTO occupancy_snapshots (business_id, venue_id, area_id, current_occupancy, last_event_id, updated_at)
                        VALUES (p_business_id, p_venue_id, p_area_id, GREATEST(0, p_delta), v_new_event_id, now())
                        RETURNING current_occupancy INTO v_new_occ;
                        EXIT;
                    EXCEPTION WHEN unique_violation THEN
                        -- Retry loop
                    END;
                END LOOP;

                RETURN jsonb_build_object(
                    'event_id', v_new_event_id,
                    'current_occupancy', v_new_occ
                );
            END;
            $$;

            -- 3. Traffic Totals RPC
            CREATE OR REPLACE FUNCTION get_traffic_totals(
                p_business_id uuid,
                p_venue_id uuid DEFAULT NULL,
                p_area_id uuid DEFAULT NULL,
                p_start_ts timestamptz DEFAULT now() - interval '24 hours',
                p_end_ts timestamptz DEFAULT now()
            ) RETURNS TABLE (
                area_id uuid,
                total_in bigint,
                total_out bigint
            ) 
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY
                SELECT 
                    oe.area_id,
                    COALESCE(SUM(CASE WHEN oe.delta > 0 THEN oe.delta ELSE 0 END), 0) as total_in,
                    COALESCE(SUM(CASE WHEN oe.delta < 0 THEN ABS(oe.delta) ELSE 0 END), 0) as total_out
                FROM occupancy_events oe
                WHERE oe.business_id = p_business_id
                AND (p_venue_id IS NULL OR oe.venue_id = p_venue_id)
                AND (p_area_id IS NULL OR oe.area_id = p_area_id)
                AND oe.timestamp >= p_start_ts
                AND oe.timestamp <= p_end_ts
                GROUP BY oe.area_id;
            END;
            $$;

            -- 4. Reset Counts RPC (Transactional)
            CREATE OR REPLACE FUNCTION reset_counts(
                p_business_id uuid,
                p_scope text, -- 'AREA', 'VENUE', 'BUSINESS'
                p_target_id uuid, -- ID of the specific scope
                p_user_id uuid
            ) RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_affected_count int;
                v_area_record RECORD;
            BEGIN
                -- Loop through affected areas to log reset events
                FOR v_area_record IN 
                    SELECT area_id, current_occupancy, venue_id FROM occupancy_snapshots
                    WHERE business_id = p_business_id
                    AND (
                        (p_scope = 'AREA' AND area_id = p_target_id) OR
                        (p_scope = 'VENUE' AND venue_id = p_target_id) OR
                        (p_scope = 'BUSINESS')
                    )
                    AND current_occupancy != 0
                LOOP
                    -- Insert reset event to track 'out' flow for history, 
                    -- BUT commonly 'reset' events are EXCLUDED from traffic totals. 
                    -- However, user said: "Representing the delta needed to return to 0".
                    -- If we count it as 'OUT', then resetting 100 people adds 100 to OUT stats. 
                    -- User requirements didn't specify exclusion, but "Source=reset" implies we can filter it if needed.
                    -- We will insert it.
                    INSERT INTO occupancy_events (
                        business_id, venue_id, area_id, delta, event_type, flow_type, user_id, timestamp
                    ) VALUES (
                        p_business_id, v_area_record.venue_id, v_area_record.area_id, 
                        -v_area_record.current_occupancy, 'RESET', 'OUT', p_user_id, now() -- Source='RESET'
                    );
                END LOOP;

                -- Update Snapshots to 0
                UPDATE occupancy_snapshots
                SET current_occupancy = 0, updated_at = now()
                WHERE business_id = p_business_id
                AND (
                    (p_scope = 'AREA' AND area_id = p_target_id) OR
                    (p_scope = 'VENUE' AND venue_id = p_target_id) OR
                    (p_scope = 'BUSINESS')
                );
                
                GET DIAGNOSTICS v_affected_count = ROW_COUNT;

                RETURN jsonb_build_object('success', true, 'reset_count', v_affected_count);
            END;
            $$;
        `;

        // Execution relies on the service role having permissions (it does)
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        if (error) {
            return NextResponse.json({ error: 'Failed to run SQL via RPC', details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'RPC Deployed (Tables, Traffic, Reset)' });

    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
