drop policy "Devices: manage by org owners" on "public"."devices";

drop policy "Devices: select by role access" on "public"."devices";

drop policy "Venues: manage by org owners" on "public"."venues";

drop policy "Venues: select by role access" on "public"."venues";


  create policy "View areas if in org or assigned to venue"
  on "public"."areas"
  as permissive
  for select
  to public
using (((venue_id IN ( SELECT venues.id
   FROM public.venues
  WHERE (venues.org_id = public.get_my_org_id()))) OR public.is_venue_staff(venue_id)));



  create policy "area_select_final"
  on "public"."areas"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.venues v
  WHERE (v.id = areas.venue_id))));



  create policy "Allow staff to view clicrs"
  on "public"."devices"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.areas a
     JOIN public.venues v ON ((v.id = a.venue_id)))
     JOIN public.venue_staff vm ON ((vm.venue_id = v.id)))
  WHERE ((a.id = devices.area_id) AND (vm.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Policy with table joins"
  on "public"."venues"
  as restrictive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IN ( SELECT venue_staff.user_id
   FROM public.venue_staff
  WHERE (venue_staff.user_id <> venue_staff.id))));



  create policy "allow_insert_if_profile_role_owner"
  on "public"."venues"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'OWNER'::public.user_role)))));


CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


