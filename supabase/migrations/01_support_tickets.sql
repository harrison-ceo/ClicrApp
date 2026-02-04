-- SUPPORT TICKETS
create table if not exists support_tickets (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id),
  user_id uuid references profiles(id),
  subject text not null,
  description text,
  status text default 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
  priority text default 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
  category text, -- TECHNICAL, BILLING, FEATURE, COMPLIANCE
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SUPPORT MESSAGES
create table if not exists support_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references support_tickets(id) on delete cascade,
  sender_id uuid references profiles(id), -- Null if System/External
  message_text text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table support_tickets enable row level security;
alter table support_messages enable row level security;

-- Index
create index idx_tickets_business on support_tickets(business_id);
create index idx_messages_ticket on support_messages(ticket_id);
