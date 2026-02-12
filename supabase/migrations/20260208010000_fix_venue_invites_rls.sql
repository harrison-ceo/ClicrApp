DROP POLICY IF EXISTS "Venue invites: insert by venue access" ON public.venue_invites;

CREATE POLICY "Venue invites: insert by venue access"
ON public.venue_invites
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    venue_id IN (
      SELECT venue_id
      FROM public.venue_staff
      WHERE user_id = auth.uid()
    )
    OR org_id IN (
      SELECT org_id
      FROM public.profiles
      WHERE id = auth.uid()
        AND org_id IS NOT NULL
    )
    OR venue_id IN (
      SELECT id
      FROM public.venues
      WHERE owner_id = auth.uid()
    )
  )
);
