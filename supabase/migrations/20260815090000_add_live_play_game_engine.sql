-- ================================================================
-- QuizFlow — Live-Play Game Engine (server-authoritative scoring)
-- Companion to 20260814090000_create_teams_and_quiz_sessions.sql
--
-- SECURITY MODEL (read before editing):
--   * `games` is anon-readable but stores only a SANITIZED quiz
--     (correct_index stripped server-side at creation).
--   * `game_answer_keys` is deliberately NOT granted to anon or
--     authenticated. Correct answers live only where SECURITY
--     DEFINER functions can read them — a client with the anon key
--     can never query them.
--   * All scoring/coin math runs inside qf_* functions with atomic
--     SQL expressions + WHERE guards, so concurrent answers/buys
--     cannot lose updates and coins cannot go negative.
--   * Tunables are stored per-game in `games.config`, seeded from
--     src/quizflow/scoring.ts (the single source of truth).
--   * No service-role key anywhere — the server still uses the anon
--     key; the definer functions are the trust boundary.
-- ================================================================

create table games (
  id text primary key,                              -- game/pin id
  mode text not null default 'classic'
    check (mode in ('classic','boss_raid','tournament')),
  status text not null default 'lobby'
    check (status in ('lobby','question_active','question_reveal','leaderboard','boss_frenzy','ended')),
  quiz jsonb not null default '[]'::jsonb,          -- sanitized: NO correct_index
  config jsonb not null default '{}'::jsonb,        -- scoring tunables (from scoring.ts)
  current_question_index int not null default -1,   -- normal-round question
  question_started_at timestamptz,                  -- server-stamped when question served
  boss_question_index int not null default -1,      -- frenzy question (0..9)
  boss_window_ends_at timestamptz,                  -- server-timed 60s window
  boss_bonus_awarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Server-only answer key store. NO grants below — definer functions only.
create table game_answer_keys (
  game_id text not null references games(id) on delete cascade,
  question_index int not null,
  correct_index int not null,
  primary key (game_id, question_index)
);

-- ── Per-team live-play state on quiz_sessions ────────────────────
alter table quiz_sessions add column game_id text references games(id);
alter table quiz_sessions add column points int not null default 0;
alter table quiz_sessions add column coins int not null default 0;
alter table quiz_sessions add column streak int not null default 0;
alter table quiz_sessions add column max_streak int not null default 0;
alter table quiz_sessions add column total_correct int not null default 0;
alter table quiz_sessions add column total_answered int not null default 0;
alter table quiz_sessions add column total_response_time_ms bigint not null default 0;
alter table quiz_sessions add column last_answered_question_index int not null default -1;
alter table quiz_sessions add column frozen_until timestamptz;
alter table quiz_sessions add column bid_multiplier int not null default 1;
alter table quiz_sessions add column bid_question_index int not null default -1;
alter table quiz_sessions add column frenzy_correct_count int not null default 0;
alter table quiz_sessions add column frenzy_response_time_ms bigint not null default 0;
alter table quiz_sessions add column violation_count int not null default 0;

create index on quiz_sessions (game_id);
create index on quiz_sessions (game_id, points desc);   -- leaderboard reads

-- ── Grants ───────────────────────────────────────────────────────
-- games / quiz_sessions: readable & writable by the server (anon key), matching
-- the existing no-RLS convention. game_answer_keys: intentionally NOT granted.
grant select, insert, update on games to anon, authenticated;
grant select, insert, update on quiz_sessions to anon, authenticated;

-- ================================================================
-- qf_create_game — create/replace a game, write answer keys, and
-- register a quiz_sessions row for every team (deterministic token
-- `sess_<team_id>`, matching the submit route's convention).
-- ================================================================
create or replace function qf_create_game(
  p_game_id text,
  p_quiz jsonb,          -- sanitized quiz (no correct_index)
  p_keys jsonb,          -- array of correct indices, in question order
  p_mode text default 'classic',
  p_config jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_team record;
  v_i int;
begin
  insert into games (id, mode, status, quiz, config, current_question_index, question_started_at)
  values (p_game_id, p_mode, 'lobby', p_quiz, p_config, -1, null)
  on conflict (id) do update
    set mode = excluded.mode,
        status = 'lobby',
        quiz = excluded.quiz,
        config = excluded.config,
        current_question_index = -1,
        question_started_at = null,
        boss_question_index = -1,
        boss_window_ends_at = null,
        boss_bonus_awarded = false;

  delete from game_answer_keys where game_id = p_game_id;
  for v_i in 0 .. greatest(jsonb_array_length(p_keys) - 1, -1) loop
    insert into game_answer_keys (game_id, question_index, correct_index)
    values (p_game_id, v_i, (p_keys->v_i)::int);
  end loop;

  for v_team in select id from teams loop
    insert into quiz_sessions (team_id, token, game_id, started_at)
    values (v_team.id, 'sess_' || v_team.id, p_game_id, now())
    on conflict (token) do update set game_id = excluded.game_id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'game_id', p_game_id,
    'question_count', jsonb_array_length(p_quiz->'questions')
  );
end;
$$;

grant execute on function qf_create_game(text, jsonb, jsonb, text, jsonb) to anon, authenticated;

-- ================================================================
-- qf_advance_game — host-driven question pacing (server-stamped).
-- actions: start | next | reveal | leaderboard | end
-- ================================================================
create or replace function qf_advance_game(p_game_id text, p_action text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_cur int;
  v_total int;
begin
  if p_action = 'start' then
    update games
      set status = 'question_active', current_question_index = 0,
          question_started_at = clock_timestamp()
      where id = p_game_id;
    update quiz_sessions set last_answered_question_index = -1 where game_id = p_game_id;

  elsif p_action = 'next' then
    select current_question_index, jsonb_array_length(quiz->'questions')
      into v_cur, v_total from games where id = p_game_id;
    if v_cur + 1 >= v_total then
      update games set status = 'ended' where id = p_game_id;
      return jsonb_build_object('ok', true, 'status', 'ended');
    end if;
    update games
      set status = 'question_active', current_question_index = v_cur + 1,
          question_started_at = clock_timestamp()
      where id = p_game_id;
    update quiz_sessions set last_answered_question_index = -1 where game_id = p_game_id;

  elsif p_action = 'reveal' then
    update games set status = 'question_reveal' where id = p_game_id;

  elsif p_action = 'leaderboard' then
    update games set status = 'leaderboard' where id = p_game_id;

  elsif p_action = 'end' then
    update games set status = 'ended' where id = p_game_id;

  else
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', (select status from games where id = p_game_id),
    'question_index', (select current_question_index from games where id = p_game_id)
  );
end;
$$;

grant execute on function qf_advance_game(text, text) to anon, authenticated;

-- ================================================================
-- qf_start_boss — open the server-owned 60s boss finale.
-- ================================================================
create or replace function qf_start_boss(p_game_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_duration_sec int;
  v_count int;
begin
  select (config->'boss_mode'->>'duration_seconds')::int
    into v_duration_sec from games where id = p_game_id;
  if v_duration_sec is null then
    return jsonb_build_object('ok', false, 'reason', 'no_game_or_config');
  end if;

  select (config->'boss_mode'->>'question_count')::int into v_count from games where id = p_game_id;
  v_count := coalesce(v_count, 10);

  update games
    set status = 'boss_frenzy',
        boss_question_index = 0,
        boss_window_ends_at = clock_timestamp() + make_interval(secs => v_duration_sec),
        question_started_at = clock_timestamp(),
        boss_bonus_awarded = false
    where id = p_game_id;

  update quiz_sessions
    set frenzy_correct_count = 0,
        frenzy_response_time_ms = 0,
        last_answered_question_index = -1
    where game_id = p_game_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'boss_frenzy',
    'question_count', v_count,
    'ends_at', to_char((select boss_window_ends_at from games where id = p_game_id), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

grant execute on function qf_start_boss(text) to anon, authenticated;

-- ================================================================
-- qf_finalize_boss — rank teams by frenzy correct count (ties by
-- cumulative frenzy response time), award per-correct points +
-- rank bonus, flip game to ended. Idempotent via boss_bonus_awarded.
-- ================================================================
create or replace function qf_finalize_boss(p_game_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_claimed boolean;
  v_config jsonb;
  v_per_correct int;
  v_rank int := 0;
  v_bonus int;
  v_rec record;
begin
  -- Idempotency guard: only one finalize wins the flag flip.
  update games set boss_bonus_awarded = true
    where id = p_game_id and not boss_bonus_awarded
    returning true into v_claimed;
  if not coalesce(v_claimed, false) then
    return jsonb_build_object('ok', false, 'reason', 'already_finalized');
  end if;

  select config into v_config from games where id = p_game_id;
  v_per_correct := (v_config->'boss_mode'->>'points_per_correct')::int;

  for v_rec in
    select id, frenzy_correct_count
    from quiz_sessions
    where game_id = p_game_id
    order by frenzy_correct_count desc, frenzy_response_time_ms asc
  loop
    v_bonus := v_per_correct * v_rec.frenzy_correct_count;
    -- Rank bonus only for actual performers (0-correct teams must
    -- never collect a placement bonus just for being fast).
    if v_rec.frenzy_correct_count > 0 and v_rank < jsonb_array_length(v_config->'rank_bonus') then
      v_bonus := v_bonus + ((v_config->'rank_bonus')->>v_rank)::int;
    end if;
    update quiz_sessions set points = points + v_bonus where id = v_rec.id;
    v_rank := v_rank + 1;
  end loop;

  update games set status = 'ended' where id = p_game_id;

  return jsonb_build_object('ok', true, 'ranked', v_rank);
end;
$$;

grant execute on function qf_finalize_boss(text) to anon, authenticated;

-- ================================================================
-- qf_apply_answer — THE scoring entry point. Recomputes elapsed from
-- games.question_started_at (never trusts the client), validates the
-- answer against the server-only key store, computes deltas from the
-- game config, and applies them with atomic guards:
--   WHERE id = ? AND last_answered_question_index <> ? AND not frozen
-- Returns (correct, points_delta, coin_delta, reason).
-- ================================================================
create or replace function qf_apply_answer(
  p_session_id uuid,
  p_question_index int,
  p_selected int
) returns table (correct boolean, points_delta int, coin_delta int, reason text)
language plpgsql security definer set search_path = public
as $$
declare
  v_row quiz_sessions%rowtype;
  v_game games%rowtype;
  v_key int;
  v_elapsed_ms bigint;
  v_difficulty text;
  v_now timestamptz := clock_timestamp();
  v_points int := 0;
  v_coins int := 0;
  v_correct boolean;
  v_new_streak int;
  v_consume_bid boolean := false;
  v_boss_active boolean;
  v_bid_mult int;
  v_base numeric;
  v_streak_mult numeric;
  v_min_response_ms int;
  v_answered int;
  v_total int;
  v_pct numeric;
  v_cap_ms int;
  v_frenzy_count int;
  v_old_points int;
  v_old_coins int;
  v_new_points int;
  v_new_coins int;
  v_quiz_idx int;
begin
  select * into v_row from quiz_sessions where id = p_session_id;
  if not found then
    return query select false, 0, 0, 'no_session'; return;
  end if;
  v_old_points := v_row.points;
  v_old_coins := v_row.coins;

  select * into v_game from games where id = v_row.game_id;
  if not found then
    return query select false, 0, 0, 'no_game'; return;
  end if;

  -- Frozen check (soft enforcement boundary lives in the WHERE too).
  if v_row.frozen_until is not null and v_row.frozen_until > v_now then
    return query select false, 0, 0, 'frozen'; return;
  end if;

  -- Already answered this question?
  if v_row.last_answered_question_index = p_question_index then
    return query select false, 0, 0, 'already_answered'; return;
  end if;

  v_boss_active := v_game.status = 'boss_frenzy';
  if not v_boss_active and v_game.status <> 'question_active' then
    return query select false, 0, 0, 'not_active'; return;
  end if;

  -- Boss window closed → lazy finalize, reject further answers.
  if v_boss_active and v_game.boss_window_ends_at is not null and v_game.boss_window_ends_at <= v_now then
    perform qf_finalize_boss(v_game.id);
    return query select false, 0, 0, 'boss_closed'; return;
  end if;

  -- Resolve the actual quiz question index. Normal rounds: the live
  -- question. Boss frenzy: the slot cycles the quiz (i % totalQ), so
  -- map the slot to the quiz question before key/difficulty lookups.
  -- The last_answered guard keeps using the slot index (unique per
  -- frenzy round; reset on advance), so repeated questions don't
  -- collide.
  if v_game.quiz->'questions' is null
     or jsonb_array_length(v_game.quiz->'questions') = 0 then
    return query select false, 0, 0, 'bad_question'; return;
  end if;
  v_quiz_idx := case when v_boss_active
    then p_question_index % jsonb_array_length(v_game.quiz->'questions')
    else p_question_index end;

  -- Server-only answer key lookup — never trust the client.
  select correct_index into v_key
    from game_answer_keys
    where game_id = v_game.id and question_index = v_quiz_idx;
  if v_key is null then
    return query select false, 0, 0, 'bad_question'; return;
  end if;

  v_correct := (p_selected = v_key);
  v_difficulty := coalesce(v_game.quiz->'questions'->v_quiz_idx->>'difficulty', 'medium');
  v_elapsed_ms := greatest(0, floor(extract(epoch from (v_now - v_game.question_started_at)) * 1000))::bigint;
  v_bid_mult := v_row.bid_multiplier;
  v_min_response_ms := coalesce((v_game.config->>'min_response_ms')::int, 100);

  if v_boss_active then
    -- Frenzy: corrects only COUNT here (+frenzy_correct_count, coins).
    -- Per-correct points + rank bonus are awarded at window close by
    -- qf_finalize_boss — never double-awarded. Wrong = boss damage.
    if v_correct then
      v_points := 0;
      v_coins := (v_game.config->'difficulty_coins'->>v_difficulty)::int;
      v_new_streak := v_row.streak; -- frenzy doesn't touch streaks
    else
      v_points := -((v_game.config->>'boss_wrong_points')::int);
      v_coins := 0;
      v_new_streak := v_row.streak;
    end if;
  else
    if v_correct then
      v_base := (v_game.config->'difficulty_points'->>v_difficulty)::numeric;
      if v_difficulty = 'hard'
         and v_elapsed_ms < coalesce((v_game.config->>'fast_threshold_ms')::int, 5000) then
        v_base := round(v_base * (v_game.config->>'fast_multiplier')::numeric);
      end if;
      v_streak_mult := 1 + least(
        v_row.streak * (v_game.config->>'streak_step')::numeric,
        (v_game.config->>'streak_cap')::numeric
      );
      if v_elapsed_ms < v_min_response_ms then
        v_points := 0; -- suspicious-bot: log-only, soft mode
      else
        v_points := round(v_base * v_streak_mult * greatest(v_bid_mult, 1));
      end if;
      v_coins := (v_game.config->'difficulty_coins'->>v_difficulty)::int;
      v_new_streak := v_row.streak + 1;
      -- Bid applies when purchased BEFORE this question started
      -- (bid_question_index is the question that was live at purchase;
      -- lobby purchases record -1, which precedes every question).
      v_consume_bid := v_bid_mult > 1
                       and v_row.bid_question_index < p_question_index;
    else
      if v_game.mode = 'boss_raid' then
        v_points := -((v_game.config->>'boss_wrong_points')::int);
      else
        v_points := 0;
      end if;
      v_coins := 0;
      v_new_streak := 0;
    end if;
  end if;

  -- Atomic apply: guards re-checked in WHERE so a concurrent
  -- purchase/answer can't slip past the pre-checks above.
  update quiz_sessions
    set points = greatest(points + v_points, 0),
        coins = coins + v_coins,
        streak = v_new_streak,
        max_streak = greatest(max_streak, v_new_streak),
        total_correct = total_correct + case when v_correct then 1 else 0 end,
        total_answered = total_answered + 1,
        total_response_time_ms = total_response_time_ms + v_elapsed_ms,
        last_answered_question_index = p_question_index,
        frenzy_correct_count = frenzy_correct_count
          + case when v_boss_active and v_correct then 1 else 0 end,
        frenzy_response_time_ms = frenzy_response_time_ms
          + case when v_boss_active and v_correct then v_elapsed_ms else 0 end,
        bid_multiplier = case when v_consume_bid then 1 else bid_multiplier end,
        bid_question_index = case when v_consume_bid then -1 else bid_question_index end
    where id = p_session_id
      and last_answered_question_index <> p_question_index
      and (frozen_until is null or frozen_until <= v_now)
    returning points, coins into v_new_points, v_new_coins;

  if v_new_points is null then
    -- Lost a race (frozen / answered between read and write) → reject.
    return query select false, 0, 0, 'rejected'; return;
  end if;

  -- Actual applied deltas (post-floor), not the pre-computed ones.
  v_points := v_new_points - v_old_points;
  v_coins := v_new_coins - v_old_coins;

  -- Boss pacing: advance the shared frenzy question once enough teams
  -- answered or the per-question cap elapsed; finalize when all 10 done.
  if v_boss_active then
    select count(*) into v_answered from quiz_sessions
      where game_id = v_game.id and last_answered_question_index = p_question_index;
    select count(*) into v_total from quiz_sessions where game_id = v_game.id;
    v_pct := v_answered::numeric / nullif(v_total, 0);
    v_cap_ms := (v_game.config->'boss_mode'->>'per_question_cap_ms')::int;
    select (config->'boss_mode'->>'question_count')::int into v_frenzy_count from games where id = v_game.id;
    v_frenzy_count := coalesce(v_frenzy_count, 10);

    if (v_pct >= (v_game.config->'boss_mode'->>'advance_when_pct_answered')::numeric
        or extract(epoch from (clock_timestamp() - v_game.question_started_at)) * 1000 >= v_cap_ms)
       and v_game.boss_question_index < v_frenzy_count - 1 then
      update games
        set boss_question_index = boss_question_index + 1,
            question_started_at = clock_timestamp()
        where id = v_game.id;
      update quiz_sessions set last_answered_question_index = -1 where game_id = v_game.id;
    elsif (v_pct >= (v_game.config->'boss_mode'->>'advance_when_pct_answered')::numeric
           or extract(epoch from (clock_timestamp() - v_game.question_started_at)) * 1000 >= v_cap_ms) then
      perform qf_finalize_boss(v_game.id);
    end if;
  end if;

  return query select v_correct, v_points, v_coins, 'ok';
end;
$$;

grant execute on function qf_apply_answer(uuid, int, int) to anon, authenticated;

-- ================================================================
-- qf_buy_powerup — atomic shop purchase.
-- Deducts coins in the same statement as the balance guard
-- (WHERE coins >= cost), so concurrent buys can't go negative.
-- Applies the effect server-side. Returns the remaining balance.
-- ================================================================
create or replace function qf_buy_powerup(
  p_session_id uuid,
  p_item text,
  p_target_session_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row quiz_sessions%rowtype;
  v_config jsonb;
  v_status text;
  v_cost int;
  v_coins int;
  v_qidx int;
  v_mult int;
  v_ms int;
begin
  select * into v_row from quiz_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  select config, status into v_config, v_status
    from games where id = v_row.game_id;
  if v_config is null then
    return jsonb_build_object('ok', false, 'reason', 'no_game');
  end if;

  v_cost := (v_config->'powerup_costs'->>p_item)::int;
  if v_cost is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_item');
  end if;

  -- Shop is closed during the boss window (keeps the write path hot).
  if v_status = 'boss_frenzy' then
    return jsonb_build_object('ok', false, 'reason', 'boss_window');
  end if;

  -- Atomic deduct + balance guard in one statement.
  update quiz_sessions
    set coins = coins - v_cost
    where id = p_session_id and coins >= v_cost
    returning coins into v_coins;

  if v_coins is null then
    return jsonb_build_object('ok', false, 'reason', 'insufficient');
  end if;

  -- Apply the effect server-side.
  if p_item like 'bid_%' then
    v_mult := case p_item when 'bid_2x' then 2 when 'bid_3x' then 3 else 4 end;
    select current_question_index into v_qidx from games where id = v_row.game_id;
    update quiz_sessions set bid_multiplier = v_mult, bid_question_index = v_qidx
      where id = p_session_id;

  elsif p_item = 'freeze_player' then
    if p_target_session_id is null then
      return jsonb_build_object('ok', false, 'reason', 'missing_target', 'coins_remaining', v_coins);
    end if;
    v_ms := (v_config->'freeze_duration_ms'->>'freeze_player')::int;
    update quiz_sessions
      set frozen_until = clock_timestamp() + make_interval(secs => v_ms / 1000.0)
      where id = p_target_session_id and game_id = v_row.game_id;

  elsif p_item = 'freeze_all' then
    v_ms := (v_config->'freeze_duration_ms'->>'freeze_all')::int;
    update quiz_sessions
      set frozen_until = clock_timestamp() + make_interval(secs => v_ms / 1000.0)
      where game_id = v_row.game_id and id <> p_session_id;

  else
    return jsonb_build_object('ok', false, 'reason', 'bad_item', 'coins_remaining', v_coins);
  end if;

  return jsonb_build_object('ok', true, 'reason', 'ok', 'coins_remaining', v_coins);
end;
$$;

grant execute on function qf_buy_powerup(uuid, text, uuid) to anon, authenticated;

-- ================================================================
-- qf_report_violation — soft-mode anti-cheat counter (host-visible).
-- ================================================================
create or replace function qf_report_violation(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  update quiz_sessions
    set violation_count = violation_count + 1
    where id = p_session_id
    returning violation_count into v_count;
  if v_count is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  return jsonb_build_object('ok', true, 'violation_count', v_count);
end;
$$;

grant execute on function qf_report_violation(uuid) to anon, authenticated;
