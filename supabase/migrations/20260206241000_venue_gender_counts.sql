-- Add gender counts on venues and sync them from areas.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS current_male_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_female_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_venue_occupancy_from_areas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  v_venue_id := COALESCE(NEW.venue_id, OLD.venue_id);
  UPDATE public.venues
  SET current_occupancy = COALESCE((
      SELECT SUM(a.current_occupancy)::integer FROM public.areas a WHERE a.venue_id = v_venue_id
    ), 0),
    current_male_count = COALESCE((
      SELECT SUM(a.count_male)::integer FROM public.areas a WHERE a.venue_id = v_venue_id
    ), 0),
    current_female_count = COALESCE((
      SELECT SUM(a.count_female)::integer FROM public.areas a WHERE a.venue_id = v_venue_id
    ), 0)
  WHERE id = v_venue_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_areas_sync_venue_occupancy ON public.areas;
CREATE TRIGGER tr_areas_sync_venue_occupancy
  AFTER INSERT OR UPDATE OF current_occupancy, count_male, count_female OR DELETE ON public.areas
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_venue_occupancy_from_areas();
