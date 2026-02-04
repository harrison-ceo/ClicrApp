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
                v_snap_exists boolean;
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
        `;

        // Execution relies on the service role having permissions (it does)
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        // Fallback: If exec_sql RPC doesn't exist (common restriction), we can't run raw SQL easily via client.
        // BUT, we can assume the user might have run it locally. 
        // IF we can't run raw SQL, we might have to rely on the user.
        // HOWEVER, many setups allow a 'exec' function for admins.

        if (error) {
            // If we can't run raw SQL, we try to create the function purely if Supabase allows management API... 
            // Actually, usually Supabase client doesn't allow raw SQL unless we have a helper.
            return NextResponse.json({ error: 'Failed to run SQL via RPC', details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'RPC Deployed' });

    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
