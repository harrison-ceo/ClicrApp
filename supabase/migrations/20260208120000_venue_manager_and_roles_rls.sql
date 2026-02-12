-- Venue managers (venue_staff with role venue_owner or manager) can manage areas, devices, and update venue for their venue.
-- Org OWNER/MANAGER already have full access via fix_org_owner_access; this adds venue-scoped manage for venue_staff.role.

-- Areas: allow venue managers to INSERT/UPDATE/DELETE areas for venues they manage
CREATE POLICY "Areas: manage by venue managers"
ON public.areas
FOR ALL
TO authenticated
USING (
  venue_id IN (
    SELECT vs.venue_id
    FROM public.venue_staff vs
    WHERE vs.user_id = auth.uid()
      AND vs.venue_id IS NOT NULL
      AND lower(trim(COALESCE(vs.role, 'staff'))) IN ('venue_owner', 'manager')
  )
)
WITH CHECK (
  venue_id IN (
    SELECT vs.venue_id
    FROM public.venue_staff vs
    WHERE vs.user_id = auth.uid()
      AND vs.venue_id IS NOT NULL
      AND lower(trim(COALESCE(vs.role, 'staff'))) IN ('venue_owner', 'manager')
  )
);

-- Devices: allow venue managers to INSERT/UPDATE/DELETE devices in areas of venues they manage
CREATE POLICY "Devices: manage by venue managers"
ON public.devices
FOR ALL
TO authenticated
USING (
  area_id IN (
    SELECT a.id
    FROM public.areas a
    INNER JOIN public.venue_staff vs ON vs.venue_id = a.venue_id AND vs.user_id = auth.uid()
    WHERE vs.venue_id IS NOT NULL
      AND lower(trim(COALESCE(vs.role, 'staff'))) IN ('venue_owner', 'manager')
  )
)
WITH CHECK (
  area_id IN (
    SELECT a.id
    FROM public.areas a
    INNER JOIN public.venue_staff vs ON vs.venue_id = a.venue_id AND vs.user_id = auth.uid()
    WHERE vs.venue_id IS NOT NULL
      AND lower(trim(COALESCE(vs.role, 'staff'))) IN ('venue_owner', 'manager')
  )
);

-- Venues: allow venue managers to UPDATE (not INSERT/DELETE) their assigned venue
CREATE POLICY "Venues: update by venue managers"
ON public.venues
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT vs.venue_id
    FROM public.venue_staff vs
    WHERE vs.user_id = auth.uid()
      AND vs.venue_id IS NOT NULL
      AND lower(trim(COALESCE(vs.role, 'staff'))) IN ('venue_owner', 'manager')
  )
)
WITH CHECK (
  id IN (
    SELECT vs.venue_id
    FROM public.venue_staff vs
    WHERE vs.user_id = auth.uid()
      AND vs.venue_id IS NOT NULL
      AND lower(trim(COALESCE(vs.role, 'staff'))) IN ('venue_owner', 'manager')
  )
);
