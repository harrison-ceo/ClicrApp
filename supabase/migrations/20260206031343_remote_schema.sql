


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."device_type" AS ENUM (
    'MOBILE',
    'FIXED_SCANNER',
    'COUNTER_ONLY'
);


ALTER TYPE "public"."device_type" OWNER TO "postgres";


CREATE TYPE "public"."flow_type" AS ENUM (
    'IN',
    'OUT'
);


ALTER TYPE "public"."flow_type" OWNER TO "postgres";


CREATE TYPE "public"."scan_result" AS ENUM (
    'ACCEPTED',
    'DENIED',
    'BANNED',
    'UNDERAGE',
    'EXPIRED'
);


ALTER TYPE "public"."scan_result" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'OWNER',
    'MANAGER',
    'STAFF',
    'VIEWER'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_business_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select business_id from public.profiles where id = auth.uid() limit 1; $$;


ALTER FUNCTION "public"."get_my_business_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select role from public.profiles where id = auth.uid() limit 1; $$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_entry_and_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 1. Update the live counter
  UPDATE public.venues
  SET current_occupancy = current_occupancy + NEW.delta
  WHERE id = NEW.venue_id;

  -- 2. Optional: Prevent occupancy from going below 0
  UPDATE public.venues 
  SET current_occupancy = 0 
  WHERE id = NEW.venue_id AND current_occupancy < 0;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_entry_and_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_occupancy_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.venues
  SET current_occupancy = GREATEST(0, current_occupancy + NEW.delta)
  WHERE id = NEW.venue_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_occupancy_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_occupancy_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.venues
  SET current_occupancy = current_occupancy + NEW.delta
  WHERE id = NEW.venue_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_occupancy_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_venue_occupancy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE venues
  SET current_occupancy = current_occupancy + NEW.delta
  WHERE id = NEW.venue_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_venue_occupancy"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."access_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid",
    "token_hash" "text" NOT NULL,
    "token_last4" "text",
    "token_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."access_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "token_hash" "text" NOT NULL,
    "org_id" "uuid",
    "reason" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "venue_id" "uuid"
);


ALTER TABLE "public"."bans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."occupancy_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "venue_id" "uuid",
    "token_id" "uuid",
    "delta" integer NOT NULL,
    "source" "text" DEFAULT 'clicker'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gender" "text",
    "age" integer,
    "zip_code" "text"
);


ALTER TABLE "public"."occupancy_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "business_id" "uuid",
    "role" "text" DEFAULT 'staff'::"text",
    "full_name" "text",
    "avatar_url" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid",
    "venue_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_staff" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "venue_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'staff'::"text"
);


ALTER TABLE "public"."venue_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "capacity" integer DEFAULT 0,
    "current_occupancy" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid"
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE ONLY "public"."access_tokens"
    ADD CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."access_tokens"
    ADD CONSTRAINT "access_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_venue_id_user_id_key" UNIQUE ("venue_id", "user_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "tr_entry_and_count" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_entry_and_count"();



CREATE OR REPLACE TRIGGER "tr_occupancy_sync" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_occupancy_sync"();



CREATE OR REPLACE TRIGGER "tr_occupancy_update" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_occupancy_update"();



CREATE OR REPLACE TRIGGER "tr_update_occupancy" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_venue_occupancy"();



ALTER TABLE ONLY "public"."access_tokens"
    ADD CONSTRAINT "access_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."access_tokens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Org Owner: Manage All" ON "public"."organizations" TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Staff: Log Occupancy" ON "public"."occupancy_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['staff'::"text", 'venue_owner'::"text", 'org_owner'::"text"]))))));



CREATE POLICY "View Profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."access_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."occupancy_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_my_business_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_business_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_business_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_entry_and_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_entry_and_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_entry_and_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_occupancy_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_occupancy_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_occupancy_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_occupancy_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_occupancy_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_occupancy_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_venue_occupancy"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_venue_occupancy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_venue_occupancy"() TO "service_role";


















GRANT ALL ON TABLE "public"."access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."bans" TO "anon";
GRANT ALL ON TABLE "public"."bans" TO "authenticated";
GRANT ALL ON TABLE "public"."bans" TO "service_role";



GRANT ALL ON TABLE "public"."occupancy_logs" TO "anon";
GRANT ALL ON TABLE "public"."occupancy_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."occupancy_logs" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."venue_staff" TO "anon";
GRANT ALL ON TABLE "public"."venue_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_staff" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


