-- Allow org owners/managers and venue staff to read occupancy logs for their venues.

ALTER TABLE public.occupancy_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Occupancy logs: select by venue access" ON public.occupancy_logs;

CREATE POLICY "Occupancy logs: select by venue access"
ON public.occupancy_logs
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('OWNER', 'MANAGER')
        AND p.org_id IS NOT NULL
        AND p.org_id = (SELECT org_id FROM public.venues v WHERE v.id = occupancy_logs.venue_id)
    )
  )
  OR (
    occupancy_logs.venue_id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid())
  )
  OR (
    occupancy_logs.venue_id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
  )
);
