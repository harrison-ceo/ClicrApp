-- 1. Device Layouts
CREATE TABLE IF NOT EXISTS public.device_layouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    owner_user_id uuid NOT NULL, -- User Scoped
    layout_mode text NOT NULL DEFAULT 'single',
    primary_device_id uuid,
    secondary_device_id uuid,
    primary_label text,
    secondary_label text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(business_id, owner_user_id)
);
ALTER TABLE public.device_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Manage own layouts" ON public.device_layouts;
CREATE POLICY "Manage own layouts" ON public.device_layouts USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- 2. Turnarounds
CREATE TABLE IF NOT EXISTS public.turnarounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    venue_id uuid,
    area_id uuid,
    device_id uuid,
    count int NOT NULL DEFAULT 1,
    reason text,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.turnarounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read turnarounds" ON public.turnarounds;
CREATE POLICY "Read turnarounds" ON public.turnarounds FOR SELECT USING (EXISTS (SELECT 1 FROM public.business_members WHERE business_id = turnarounds.business_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Insert turnarounds" ON public.turnarounds;
CREATE POLICY "Insert turnarounds" ON public.turnarounds FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.business_members WHERE business_id = turnarounds.business_id AND user_id = auth.uid()));

-- 3. RPC: UPDATE DEVICE NAME
CREATE OR REPLACE FUNCTION update_device_name(p_business_id uuid, p_device_id uuid, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_device jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = p_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    UPDATE devices SET name = p_name WHERE id = p_device_id AND business_id = p_business_id RETURNING to_jsonb(devices.*) INTO v_device;
    RETURN v_device;
END;
$$;

-- 4. RPC: UPSERT LAYOUT
CREATE OR REPLACE FUNCTION upsert_device_layout(
    p_business_id uuid,
    p_layout_mode text,
    p_primary_device_id uuid,
    p_secondary_device_id uuid,
    p_primary_label text DEFAULT NULL,
    p_secondary_label text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_ret jsonb;
BEGIN
    INSERT INTO device_layouts (business_id, owner_user_id, layout_mode, primary_device_id, secondary_device_id, primary_label, secondary_label)
    VALUES (p_business_id, auth.uid(), p_layout_mode, p_primary_device_id, p_secondary_device_id, p_primary_label, p_secondary_label)
    ON CONFLICT (business_id, owner_user_id) DO UPDATE SET
        layout_mode = EXCLUDED.layout_mode,
        primary_device_id = EXCLUDED.primary_device_id,
        secondary_device_id = EXCLUDED.secondary_device_id,
        primary_label = EXCLUDED.primary_label,
        secondary_label = EXCLUDED.secondary_label,
        updated_at = now()
    RETURNING to_jsonb(device_layouts.*) INTO v_ret;
    RETURN v_ret;
END;
$$;

-- 5. RPC: ADD TURNAROUND
CREATE OR REPLACE FUNCTION add_turnaround(
    p_business_id uuid, p_venue_id uuid, p_area_id uuid, p_device_id uuid, p_count int DEFAULT 1
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = p_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    INSERT INTO turnarounds (business_id, venue_id, area_id, device_id, count, created_by)
    VALUES (p_business_id, p_venue_id, p_area_id, p_device_id, p_count, auth.uid());
    RETURN 1;
END;
$$;

-- 6. RPC: GET REPORT SUMMARY (Revised)
CREATE OR REPLACE FUNCTION get_report_summary(
    p_business_id uuid,
    p_venue_id uuid DEFAULT NULL,
    p_area_id uuid DEFAULT NULL,
    p_start_ts timestamptz DEFAULT now() - interval '24 hours',
    p_end_ts timestamptz DEFAULT now()
)
RETURNS TABLE (
    total_entries_gross bigint,
    total_exits_gross bigint,
    turnarounds_count bigint,
    net_entries_adjusted bigint,
    entries_manual bigint,
    entries_scan bigint,
    scans_total bigint,
    scans_accepted bigint,
    scans_denied bigint,
    effective_start_ts timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_last_reset timestamptz;
    v_search_start timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = p_business_id AND user_id = auth.uid()) THEN
        RETURN QUERY SELECT 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint, now();
        RETURN;
    END IF;

    -- Find last reset
    SELECT MAX(created_at) INTO v_last_reset
    FROM occupancy_events
    WHERE business_id = p_business_id
    AND (p_venue_id IS NULL OR venue_id = p_venue_id)
    AND (p_area_id IS NULL OR area_id = p_area_id)
    AND event_type = 'RESET';

    v_search_start := GREATEST(p_start_ts, COALESCE(v_last_reset, '-infinity'::timestamptz));

    RETURN QUERY
    WITH 
    traffic AS (
        SELECT 
            COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as gross_in,
            COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as gross_out,
            COALESCE(SUM(CASE WHEN delta > 0 AND source = 'clicker' THEN delta ELSE 0 END), 0) as manual_in,
            COALESCE(SUM(CASE WHEN delta > 0 AND source = 'auto_scan' THEN delta ELSE 0 END), 0) as scan_in
        FROM occupancy_events
        WHERE business_id = p_business_id
        AND (p_venue_id IS NULL OR venue_id = p_venue_id)
        AND (p_area_id IS NULL OR area_id = p_area_id)
        AND created_at >= v_search_start AND created_at <= p_end_ts
        AND event_type != 'RESET'
    ),
    turns AS (
        SELECT COALESCE(SUM(count), 0) as val
        FROM turnarounds
        WHERE business_id = p_business_id
        AND (p_venue_id IS NULL OR venue_id = p_venue_id)
        AND (p_area_id IS NULL OR area_id = p_area_id)
        AND created_at >= v_search_start AND created_at <= p_end_ts
    ),
    scans AS (
         SELECT 
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN scan_result = 'ACCEPTED' THEN 1 ELSE 0 END), 0) as accepted,
            COALESCE(SUM(CASE WHEN scan_result != 'ACCEPTED' THEN 1 ELSE 0 END), 0) as denied
         FROM id_scans
         WHERE business_id = p_business_id
         AND (p_venue_id IS NULL OR venue_id = p_venue_id)
         AND (p_area_id IS NULL OR area_id = p_area_id)
         AND created_at >= v_search_start AND created_at <= p_end_ts
    )
    SELECT
        t.gross_in,
        t.gross_out,
        tu.val,
        (t.gross_in - tu.val) as net_adjusted,
        t.manual_in,
        t.scan_in,
        s.total,
        s.accepted,
        s.denied,
        v_search_start
    FROM traffic t, turns tu, scans s;
END;
$$;
