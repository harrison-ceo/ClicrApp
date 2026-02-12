-- Restore venue and device policies dropped by 20260208204634.
-- Ensure helper exists so policy works when this migration runs standalone (e.g. db push).
CREATE OR REPLACE FUNCTION public.user_can_manage_venue_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('OWNER', 'MANAGER')
        AND p.org_id IS NOT NULL
        AND p.org_id = p_org_id
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_manage_venue_org(uuid) TO authenticated;

-- Venues: remove broken/duplicate policies from 20260208204634, restore select + manage
DROP POLICY IF EXISTS "Venues: manage by org owners" ON public.venues;
DROP POLICY IF EXISTS "allow_insert_if_profile_role_owner" ON public.venues;

CREATE POLICY "Venues: select by role access"
ON public.venues
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('OWNER', 'MANAGER')
      AND p.org_id IS NOT NULL
      AND p.org_id = venues.org_id
  )
  OR venues.id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid())
  OR venues.id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
);

CREATE POLICY "Venues: manage by org owners"
ON public.venues
FOR ALL
TO authenticated
USING (public.user_can_manage_venue_org(venues.org_id))
WITH CHECK (
  public.user_can_manage_venue_org(venues.org_id)
  AND venues.owner_id = auth.uid()
);

-- Devices: restore select + manage for org owners and staff
DROP POLICY IF EXISTS "Allow staff to view clicrs" ON public.devices;

CREATE POLICY "Devices: select by role access"
ON public.devices
FOR SELECT
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
  OR devices.area_id IN (
    SELECT a.id
    FROM public.areas a
    WHERE a.venue_id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid())
  )
  OR devices.area_id IN (
    SELECT a.id
    FROM public.areas a
    WHERE a.venue_id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
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
