-- BACKFILL MISSING PROFILES
-- Run this in your Supabase SQL Editor to generate profiles for users 
-- who signed up before the valid profile creation logic was in place.

insert into public.profiles (id, email, role, full_name)
select 
    id, 
    email, 
    'OWNER', -- Defaulting everyone to OWNER so they can create businesses
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
from auth.users
where id not in (select id from public.profiles);

-- Optional: Verify the count
select count(*) as new_profiles_count from public.profiles;
