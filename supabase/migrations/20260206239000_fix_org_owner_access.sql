-- Normalize role checks for org owners/managers across RLS and functions.

-- Venues
DROP POLICY IF EXISTS "Venues: select by role access" ON public.venues;
DROP POLICY IF EXISTS "Venues: manage by org owners" ON public.venues;

CREATE POLICY "Venues: select by role access"
ON public.venues
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('OWNER', 'MANAGER')
        AND p.org_id IS NOT NULL
        AND p.org_id = venues.org_id
    )
  )
  OR (
    venues.id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid())
  )
  OR (
    venues.id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Venues: manage by org owners"
ON public.venues
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = venues.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = venues.org_id
  )
);

-- Areas
DROP POLICY IF EXISTS "Areas: select by role access" ON public.areas;
DROP POLICY IF EXISTS "Areas: manage by org owners" ON public.areas;

CREATE POLICY "Areas: select by role access"
ON public.areas
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('OWNER', 'MANAGER')
        AND p.org_id IS NOT NULL
        AND p.org_id = (SELECT v.org_id FROM public.venues v WHERE v.id = areas.venue_id)
    )
  )
  OR (
    areas.venue_id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid())
  )
  OR (
    areas.venue_id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Areas: manage by org owners"
ON public.areas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = (SELECT v.org_id FROM public.venues v WHERE v.id = areas.venue_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = (SELECT v.org_id FROM public.venues v WHERE v.id = areas.venue_id)
  )
);

-- Devices
DROP POLICY IF EXISTS "Devices: select by role access" ON public.devices;
DROP POLICY IF EXISTS "Devices: manage by org owners" ON public.devices;

CREATE POLICY "Devices: select by role access"
ON public.devices
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('OWNER', 'MANAGER')
        AND p.org_id IS NOT NULL
        AND p.org_id = (
          SELECT v.org_id
          FROM public.venues v
          INNER JOIN public.areas a ON a.venue_id = v.id
          WHERE a.id = devices.area_id
        )
    )
  )
  OR (
    devices.area_id IN (
      SELECT a.id
      FROM public.areas a
      WHERE a.venue_id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR (
    devices.area_id IN (
      SELECT a.id
      FROM public.areas a
      WHERE a.venue_id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Devices: manage by org owners"
ON public.devices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = (
        SELECT v.org_id
        FROM public.venues v
        INNER JOIN public.areas a ON a.venue_id = v.id
        WHERE a.id = devices.area_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = (
        SELECT v.org_id
        FROM public.venues v
        INNER JOIN public.areas a ON a.venue_id = v.id
        WHERE a.id = devices.area_id
      )
  )
);

-- update_area_occupancy: normalize role comparisons
CREATE OR REPLACE FUNCTION public.update_area_occupancy(
  p_area_id uuid,
  p_device_id uuid,
  p_count_male integer,
  p_count_female integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
  v_old_male integer;
  v_old_female integer;
  v_delta_male integer;
  v_delta_female integer;
  v_role text;
  v_org_id uuid;
  v_profile_venue_id uuid;
  v_area_id uuid;
BEGIN
  SELECT role, org_id, venue_id INTO v_role, v_org_id, v_profile_venue_id
  FROM public.profiles
  WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_area_id := p_area_id;
  SELECT venue_id, COALESCE(count_male, 0), COALESCE(count_female, 0)
    INTO v_venue_id, v_old_male, v_old_female
  FROM public.areas
  WHERE id = v_area_id
  FOR UPDATE;

  IF v_venue_id IS NULL THEN
    SELECT area_id INTO v_area_id FROM public.devices WHERE id = p_device_id;
    IF v_area_id IS NULL THEN
      RAISE EXCEPTION 'Device not found: %', p_device_id;
    END IF;
    SELECT venue_id, COALESCE(count_male, 0), COALESCE(count_female, 0)
      INTO v_venue_id, v_old_male, v_old_female
    FROM public.areas
    WHERE id = v_area_id
    FOR UPDATE;
    IF v_venue_id IS NULL THEN
      RAISE EXCEPTION 'Area not found: %', v_area_id;
    END IF;
  END IF;

  IF v_role IN ('OWNER', 'MANAGER') THEN
    IF v_org_id IS NULL OR v_org_id <> (SELECT org_id FROM public.venues WHERE id = v_venue_id) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSE
    IF v_profile_venue_id IS DISTINCT FROM v_venue_id
      AND NOT EXISTS (SELECT 1 FROM public.venue_staff WHERE user_id = auth.uid() AND venue_id = v_venue_id)
    THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  v_delta_male := p_count_male - v_old_male;
  v_delta_female := p_count_female - v_old_female;

  UPDATE public.areas
  SET count_male = p_count_male,
      count_female = p_count_female,
      updated_at = now()
  WHERE id = v_area_id;

  IF v_delta_male <> 0 THEN
    INSERT INTO public.occupancy_logs (venue_id, area_id, device_id, delta, source, gender)
    VALUES (v_venue_id, v_area_id, p_device_id, v_delta_male, 'clicker', 'M');
  END IF;
  IF v_delta_female <> 0 THEN
    INSERT INTO public.occupancy_logs (venue_id, area_id, device_id, delta, source, gender)
    VALUES (v_venue_id, v_area_id, p_device_id, v_delta_female, 'clicker', 'F');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_area_occupancy(uuid, uuid, integer, integer) TO authenticated;
