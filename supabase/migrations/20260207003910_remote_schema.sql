


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


CREATE OR REPLACE FUNCTION "public"."get_my_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select role from public.profiles where id = auth.uid() limit 1; $$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_data"() RETURNS TABLE("role" "text", "org_id" "uuid", "venue_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT role, org_id, venue_id 
  FROM public.profiles 
  WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_entry_and_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.area_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.venues SET current_occupancy = current_occupancy + NEW.delta WHERE id = NEW.venue_id;
  UPDATE public.venues SET current_occupancy = 0 WHERE id = NEW.venue_id AND current_occupancy < 0;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."handle_entry_and_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_occupancy_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.area_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.venues SET current_occupancy = GREATEST(0, current_occupancy + NEW.delta) WHERE id = NEW.venue_id;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."handle_occupancy_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_occupancy_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.area_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.venues SET current_occupancy = current_occupancy + NEW.delta WHERE id = NEW.venue_id;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."handle_occupancy_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_venue_staff"("target_venue_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venue_staff
    WHERE venue_id = target_venue_id 
    AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_venue_staff"("target_venue_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_area_occupancy_from_breakdown"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.current_occupancy := COALESCE(NEW.count_male, 0) + COALESCE(NEW.count_female, 0);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_area_occupancy_from_breakdown"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_area_occupancy_from_devices"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.areas
  SET current_occupancy = COALESCE((
    SELECT SUM(d.current_count)::integer FROM public.devices d WHERE d.area_id = COALESCE(NEW.area_id, OLD.area_id) AND d.is_active = true
  ), 0),
  updated_at = now()
  WHERE id = COALESCE(NEW.area_id, OLD.area_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_area_occupancy_from_devices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_venue_occupancy_from_areas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  v_venue_id := COALESCE(NEW.venue_id, OLD.venue_id);
  UPDATE public.venues
  SET current_occupancy = COALESCE((
    SELECT SUM(a.current_occupancy)::integer FROM public.areas a WHERE a.venue_id = v_venue_id
  ), 0)
  WHERE id = v_venue_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_venue_occupancy_from_areas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_area_occupancy"("p_area_id" "uuid", "p_device_id" "uuid", "p_count_male" integer, "p_count_female" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_venue_id uuid;
  v_old_male integer;
  v_old_female integer;
  v_delta_male integer;
  v_delta_female integer;
BEGIN
  SELECT venue_id, COALESCE(count_male, 0), COALESCE(count_female, 0)
    INTO v_venue_id, v_old_male, v_old_female
  FROM public.areas
  WHERE id = p_area_id
  FOR UPDATE;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Area not found: %', p_area_id;
  END IF;

  v_delta_male := p_count_male - v_old_male;
  v_delta_female := p_count_female - v_old_female;

  UPDATE public.areas
  SET count_male = p_count_male,
      count_female = p_count_female,
      updated_at = now()
  WHERE id = p_area_id;

  IF v_delta_male <> 0 THEN
    INSERT INTO public.occupancy_logs (venue_id, area_id, device_id, delta, source, gender)
    VALUES (v_venue_id, p_area_id, p_device_id, v_delta_male, 'clicker', 'M');
  END IF;
  IF v_delta_female <> 0 THEN
    INSERT INTO public.occupancy_logs (venue_id, area_id, device_id, delta, source, gender)
    VALUES (v_venue_id, p_area_id, p_device_id, v_delta_female, 'clicker', 'F');
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_area_occupancy"("p_area_id" "uuid", "p_device_id" "uuid", "p_count_male" integer, "p_count_female" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_area_occupancy"("p_area_id" "uuid", "p_device_id" "uuid", "p_count_male" integer, "p_count_female" integer) IS 'Updates area count_male/count_female and logs each delta to occupancy_logs with device_id for audit.';



CREATE OR REPLACE FUNCTION "public"."update_venue_occupancy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.area_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.venues SET current_occupancy = current_occupancy + NEW.delta WHERE id = NEW.venue_id;
  RETURN NEW;
END; $$;


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


CREATE TABLE IF NOT EXISTS "public"."areas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "capacity" integer DEFAULT 0,
    "area_type" "text" DEFAULT 'MAIN'::"text",
    "counting_mode" "text" DEFAULT 'BOTH'::"text",
    "is_active" boolean DEFAULT true,
    "current_occupancy" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "count_male" integer DEFAULT 0,
    "count_female" integer DEFAULT 0
);


ALTER TABLE "public"."areas" OWNER TO "postgres";


COMMENT ON TABLE "public"."areas" IS 'Monitoring zones within a venue. Accessible to anyone who is part of that venue (org or staff).';



COMMENT ON COLUMN "public"."areas"."count_male" IS 'Male count for this area; shared by all clickers in the area.';



COMMENT ON COLUMN "public"."areas"."count_female" IS 'Female count for this area; shared by all clickers in the area.';



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


CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "area_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "flow_mode" "text" DEFAULT 'BIDIRECTIONAL'::"text",
    "current_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "count_male" integer DEFAULT 0,
    "count_female" integer DEFAULT 0,
    CONSTRAINT "devices_flow_mode_check" CHECK (("flow_mode" = ANY (ARRAY['BIDIRECTIONAL'::"text", 'IN_ONLY'::"text", 'OUT_ONLY'::"text"])))
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


COMMENT ON TABLE "public"."devices" IS 'Clickers/devices per area (many-to-one). current_count logs occupancy; area.current_occupancy is synced from sum of device counts.';



COMMENT ON COLUMN "public"."devices"."count_male" IS 'Count of males in area from this device.';



COMMENT ON COLUMN "public"."devices"."count_female" IS 'Count of females in area from this device.';



CREATE TABLE IF NOT EXISTS "public"."occupancy_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "venue_id" "uuid",
    "token_id" "uuid",
    "delta" integer NOT NULL,
    "source" "text" DEFAULT 'clicker'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gender" "text",
    "age" integer,
    "zip_code" "text",
    "area_id" "uuid",
    "device_id" "uuid"
);


ALTER TABLE "public"."occupancy_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "used_by" "uuid",
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."org_invites" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_invites" IS 'Invite links for users to join an organization.';



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
    "role" "public"."user_role" DEFAULT 'STAFF'::"public"."user_role",
    "full_name" "text",
    "avatar_url" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid",
    "venue_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "message_text" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."support_ticket_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."support_ticket_messages" IS 'Messages for support tickets.';



CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "venue_id" "uuid",
    "user_id" "uuid",
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "priority" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "category" "text" DEFAULT 'TECHNICAL'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "support_tickets_category_check" CHECK (("category" = ANY (ARRAY['TECHNICAL'::"text", 'BILLING'::"text", 'FEATURE_REQUEST'::"text", 'COMPLIANCE'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "support_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


COMMENT ON TABLE "public"."support_tickets" IS 'User-submitted support requests.';



CREATE TABLE IF NOT EXISTS "public"."venue_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "used_by" "uuid",
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."venue_invites" OWNER TO "postgres";


COMMENT ON TABLE "public"."venue_invites" IS 'Invite links for users to join a venue.';



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



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_invites"
    ADD CONSTRAINT "venue_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."venue_invites"
    ADD CONSTRAINT "venue_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_venue_id_user_id_key" UNIQUE ("venue_id", "user_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE INDEX "devices_area_id_idx" ON "public"."devices" USING "btree" ("area_id");



CREATE INDEX "org_invites_code_idx" ON "public"."org_invites" USING "btree" ("code");



CREATE INDEX "org_invites_org_id_idx" ON "public"."org_invites" USING "btree" ("org_id");



CREATE INDEX "support_ticket_messages_ticket_id_idx" ON "public"."support_ticket_messages" USING "btree" ("ticket_id");



CREATE INDEX "support_tickets_org_id_idx" ON "public"."support_tickets" USING "btree" ("org_id");



CREATE INDEX "support_tickets_user_id_idx" ON "public"."support_tickets" USING "btree" ("user_id");



CREATE INDEX "support_tickets_venue_id_idx" ON "public"."support_tickets" USING "btree" ("venue_id");



CREATE INDEX "venue_invites_code_idx" ON "public"."venue_invites" USING "btree" ("code");



CREATE INDEX "venue_invites_org_id_idx" ON "public"."venue_invites" USING "btree" ("org_id");



CREATE INDEX "venue_invites_venue_id_idx" ON "public"."venue_invites" USING "btree" ("venue_id");



CREATE OR REPLACE TRIGGER "tr_areas_sync_occupancy_breakdown" BEFORE INSERT OR UPDATE OF "count_male", "count_female" ON "public"."areas" FOR EACH ROW EXECUTE FUNCTION "public"."sync_area_occupancy_from_breakdown"();



CREATE OR REPLACE TRIGGER "tr_areas_sync_venue_occupancy" AFTER INSERT OR DELETE OR UPDATE OF "current_occupancy", "count_male", "count_female" ON "public"."areas" FOR EACH ROW EXECUTE FUNCTION "public"."sync_venue_occupancy_from_areas"();



CREATE OR REPLACE TRIGGER "tr_entry_and_count" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_entry_and_count"();



CREATE OR REPLACE TRIGGER "tr_occupancy_sync" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_occupancy_sync"();



CREATE OR REPLACE TRIGGER "tr_occupancy_update" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_occupancy_update"();



CREATE OR REPLACE TRIGGER "tr_update_occupancy" AFTER INSERT ON "public"."occupancy_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_venue_occupancy"();



ALTER TABLE ONLY "public"."access_tokens"
    ADD CONSTRAINT "access_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."access_tokens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."occupancy_logs"
    ADD CONSTRAINT "occupancy_logs_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_invites"
    ADD CONSTRAINT "venue_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_invites"
    ADD CONSTRAINT "venue_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_invites"
    ADD CONSTRAINT "venue_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_invites"
    ADD CONSTRAINT "venue_invites_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_staff"
    ADD CONSTRAINT "venue_staff_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Org Owner: Manage All" ON "public"."organizations" TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Org admins can see all venues in their org" ON "public"."venues" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."org_id" = "venues"."org_id"))));



CREATE POLICY "Org invites: insert by org access" ON "public"."org_invites" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL))))));



CREATE POLICY "Org invites: select by org access" ON "public"."org_invites" FOR SELECT TO "authenticated" USING (("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))));



CREATE POLICY "Organizations: select by member or owner" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR ("id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL))))));



CREATE POLICY "Staff can insert logs for their venue" ON "public"."occupancy_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."venue_staff"
  WHERE (("venue_staff"."venue_id" = "occupancy_logs"."venue_id") AND ("venue_staff"."user_id" = "auth"."uid"())))));



CREATE POLICY "Support ticket messages: insert by ticket access" ON "public"."support_ticket_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND ("ticket_id" IN ( SELECT "support_tickets"."id"
   FROM "public"."support_tickets"
  WHERE (("support_tickets"."user_id" = "auth"."uid"()) OR ("support_tickets"."org_id" IN ( SELECT "profiles"."org_id"
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))) OR ("support_tickets"."venue_id" IN ( SELECT "venue_staff"."venue_id"
           FROM "public"."venue_staff"
          WHERE ("venue_staff"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Support ticket messages: select by ticket access" ON "public"."support_ticket_messages" FOR SELECT TO "authenticated" USING (("ticket_id" IN ( SELECT "support_tickets"."id"
   FROM "public"."support_tickets"
  WHERE (("support_tickets"."user_id" = "auth"."uid"()) OR ("support_tickets"."org_id" IN ( SELECT "profiles"."org_id"
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))) OR ("support_tickets"."venue_id" IN ( SELECT "venue_staff"."venue_id"
           FROM "public"."venue_staff"
          WHERE ("venue_staff"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Support tickets: insert by access" ON "public"."support_tickets" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))) OR ("venue_id" IN ( SELECT "venue_staff"."venue_id"
   FROM "public"."venue_staff"
  WHERE ("venue_staff"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Support tickets: select by access" ON "public"."support_tickets" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))) OR ("venue_id" IN ( SELECT "venue_staff"."venue_id"
   FROM "public"."venue_staff"
  WHERE ("venue_staff"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can only see venues in their organization" ON "public"."venues" FOR SELECT USING (("org_id" = "public"."get_my_org_id"()));



CREATE POLICY "Venue invites: insert by venue access" ON "public"."venue_invites" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND (("venue_id" IN ( SELECT "venue_staff"."venue_id"
   FROM "public"."venue_staff"
  WHERE ("venue_staff"."user_id" = "auth"."uid"()))) OR ("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))))));



CREATE POLICY "Venue invites: select by venue access" ON "public"."venue_invites" FOR SELECT TO "authenticated" USING ((("venue_id" IN ( SELECT "venue_staff"."venue_id"
   FROM "public"."venue_staff"
  WHERE ("venue_staff"."user_id" = "auth"."uid"()))) OR ("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL))))));



CREATE POLICY "Venue owners can manage devices" ON "public"."devices" USING ((EXISTS ( SELECT 1
   FROM "public"."venue_staff"
  WHERE (("venue_staff"."venue_id" = "devices"."area_id") AND ("venue_staff"."user_id" = "auth"."uid"()) AND ("venue_staff"."role" = 'venue_owner'::"text")))));



CREATE POLICY "Venues: org owner manage" ON "public"."venues" TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR ("org_id" IN ( SELECT "organizations"."id"
   FROM "public"."organizations"
  WHERE ("organizations"."owner_id" = "auth"."uid"()))))) WITH CHECK ((("owner_id" = "auth"."uid"()) OR ("org_id" IN ( SELECT "organizations"."id"
   FROM "public"."organizations"
  WHERE ("organizations"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Venues: select by org or staff" ON "public"."venues" FOR SELECT TO "authenticated" USING ((("org_id" IN ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" IS NOT NULL)))) OR ("id" IN ( SELECT "venue_staff"."venue_id"
   FROM "public"."venue_staff"
  WHERE ("venue_staff"."user_id" = "auth"."uid"())))));



CREATE POLICY "View Profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "View areas if in org or assigned to venue" ON "public"."areas" FOR SELECT USING ((("venue_id" IN ( SELECT "venues"."id"
   FROM "public"."venues"
  WHERE ("venues"."org_id" = "public"."get_my_org_id"()))) OR "public"."is_venue_staff"("venue_id")));



ALTER TABLE "public"."access_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "area_select_final" ON "public"."areas" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."venues" "v"
  WHERE ("v"."id" = "areas"."venue_id"))));



ALTER TABLE "public"."areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "device_select_final" ON "public"."devices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."areas" "a"
  WHERE ("a"."id" = "devices"."area_id"))));



ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_insert_final" ON "public"."occupancy_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."venue_id" = "occupancy_logs"."venue_id") AND ("p"."role" = ANY (ARRAY['STAFF'::"public"."user_role", 'MANAGER'::"public"."user_role", 'OWNER'::"public"."user_role"]))))));



ALTER TABLE "public"."occupancy_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_ticket_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venue_select_final" ON "public"."venues" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ((("p"."role" = 'OWNER'::"public"."user_role") AND ("p"."org_id" = "venues"."org_id")) OR ("p"."venue_id" = "venues"."id"))))));



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



GRANT ALL ON FUNCTION "public"."get_my_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_entry_and_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_entry_and_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_entry_and_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_occupancy_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_occupancy_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_occupancy_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_occupancy_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_occupancy_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_occupancy_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_venue_staff"("target_venue_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_venue_staff"("target_venue_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_venue_staff"("target_venue_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_area_occupancy_from_breakdown"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_area_occupancy_from_breakdown"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_area_occupancy_from_breakdown"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_area_occupancy_from_devices"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_area_occupancy_from_devices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_area_occupancy_from_devices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_venue_occupancy_from_areas"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_venue_occupancy_from_areas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_venue_occupancy_from_areas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_area_occupancy"("p_area_id" "uuid", "p_device_id" "uuid", "p_count_male" integer, "p_count_female" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_area_occupancy"("p_area_id" "uuid", "p_device_id" "uuid", "p_count_male" integer, "p_count_female" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_area_occupancy"("p_area_id" "uuid", "p_device_id" "uuid", "p_count_male" integer, "p_count_female" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_venue_occupancy"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_venue_occupancy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_venue_occupancy"() TO "service_role";


















GRANT ALL ON TABLE "public"."access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."areas" TO "anon";
GRANT ALL ON TABLE "public"."areas" TO "authenticated";
GRANT ALL ON TABLE "public"."areas" TO "service_role";



GRANT ALL ON TABLE "public"."bans" TO "anon";
GRANT ALL ON TABLE "public"."bans" TO "authenticated";
GRANT ALL ON TABLE "public"."bans" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "anon";
GRANT ALL ON TABLE "public"."devices" TO "authenticated";
GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."occupancy_logs" TO "anon";
GRANT ALL ON TABLE "public"."occupancy_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."occupancy_logs" TO "service_role";



GRANT ALL ON TABLE "public"."org_invites" TO "anon";
GRANT ALL ON TABLE "public"."org_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invites" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."support_ticket_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."venue_invites" TO "anon";
GRANT ALL ON TABLE "public"."venue_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_invites" TO "service_role";



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


