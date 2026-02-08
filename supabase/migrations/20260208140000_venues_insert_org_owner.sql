-- Avoid "Policy with table joins" by using a SECURITY DEFINER function so RLS on organizations
-- is not evaluated during venue policy check.

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

DROP POLICY IF EXISTS "Venues: manage by org owners" ON public.venues;

CREATE POLICY "Venues: manage by org owners"
ON public.venues
FOR ALL
TO authenticated
USING (public.user_can_manage_venue_org(venues.org_id))
WITH CHECK (
  public.user_can_manage_venue_org(venues.org_id)
  AND venues.owner_id = auth.uid()
);
