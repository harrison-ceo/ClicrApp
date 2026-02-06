-- Allow org members to SELECT their org (for venue join / header name)
CREATE POLICY "Organizations: select by member or owner"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND org_id IS NOT NULL)
);

-- Allow authenticated users to SELECT venues they can access:
-- 1. Venues in their org (profile.org_id = venues.org_id)
-- 2. Venues they are assigned to (venue_staff)
CREATE POLICY "Venues: select by org or staff"
ON public.venues
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid() AND org_id IS NOT NULL
  )
  OR id IN (
    SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid()
  )
);

-- Allow org owners to insert/update/delete their org's venues (owner_id = auth.uid() or org.owner_id)
CREATE POLICY "Venues: org owner manage"
ON public.venues
FOR ALL
TO authenticated
USING (
  owner_id = auth.uid()
  OR org_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR org_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);
