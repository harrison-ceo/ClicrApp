-- Create a table for storing scan events directly (IDScanEvent structure)
-- This allows searching in the Guest Directory by name/details

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

create table if not exists scan_events (
  id uuid primary key default uuid_generate_v4(),
  venue_id text not null,
  scan_result text not null, -- 'ACCEPTED', 'DENIED', 'WARNED', 'ERROR'
  
  -- Demographics
  age int default 0,
  age_band text,
  sex text default 'U',
  zip_code text,

  -- PII (Ensure RLS policies are applied for privacy!)
  first_name text,
  last_name text,
  dob text, -- YYYYMMDD or ISO
  id_number_last4 text,
  issuing_state text,
  id_type text, -- 'DRIVERS_LICENSE', etc
  
  -- Metadata
  timestamp timestamptz default now(),
  created_at timestamptz default now()
);

-- Index for fast sorting/filtering
create index if not exists idx_scan_events_time on scan_events(timestamp desc);
create index if not exists idx_scan_events_venue on scan_events(venue_id);
create index if not exists idx_scan_events_name on scan_events(last_name, first_name);

-- RLS: Only authenticated users can insert (via server action) or read
alter table scan_events enable row level security;

-- Policy: Allow inserts (usually service role does this, but for now allow authenticated)
create policy "Allow authenticated inserts" on scan_events
  for insert with check (auth.role() = 'authenticated');

-- Policy: Allow read (adjust as strictly as needed)
create policy "Allow authenticated reads" on scan_events
  for select using (auth.role() = 'authenticated');
