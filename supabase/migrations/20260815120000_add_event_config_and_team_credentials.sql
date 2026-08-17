-- ================================================================
-- QuizFlow — Admin/Student Dashboard schema
-- Companion to 20260814090000_create_teams_and_quiz_sessions.sql
-- and 20260815090000_add_live_play_game_engine.sql
--
-- Adds:
--   * event_config — single-row day-of gate (admin toggle + optional
--     opens_at / closes_at schedule). anon-readable but contains no
--     secrets, so students can render gate screens before logging in.
--   * teams.username / password_salt / password_hash — team-shared
--     credentials created by the admin (one per team, one device).
--     Passwords are PBKDF2 hashes (Web Crypto, server-side only).
-- ================================================================

create table event_config (
  id int primary key default 1 check (id = 1),
  login_open boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into event_config (id, login_open)
values (1, false)
on conflict (id) do nothing;

-- ── Team credentials ─────────────────────────────────────────────
alter table teams add column if not exists username text;
alter table teams add column if not exists password_salt text;
alter table teams add column if not exists password_hash text;
alter table teams add column if not exists password_updated_at timestamptz;

create unique index if not exists teams_username_key on teams (username) where username is not null;

-- ── Grants ───────────────────────────────────────────────────────
-- The original team migration ships without grants (they were applied
-- manually to the local stack). Re-issuing them here is idempotent and
-- also fixes the cloud project, which still lacks them.
grant select, insert, update on event_config to anon, authenticated;
grant select, insert, update, delete on teams to anon, authenticated;
grant select, insert, update on quiz_sessions to anon, authenticated;
