-- ================================================================
-- QuizFlow — Team Login Event Schema (100–150 teams, 4 members each,
-- 1 device per team, race-safe single-claim login)
-- ================================================================

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  roster jsonb not null,           -- ["Alice","Bob","Carol","Dave"]
  claimed_by text,
  device_id text,
  claimed_at timestamptz,
  status text not null default 'waiting'
    check (status in ('waiting','claimed','in_progress','submitted')),
  created_at timestamptz not null default now()
);

create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  token text not null unique,
  started_at timestamptz,
  submitted_at timestamptz,
  answers jsonb default '[]'::jsonb,
  score int default 0,
  violations jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index on teams (code);
create index on quiz_sessions (team_id);
