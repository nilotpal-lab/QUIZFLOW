-- ================================================================
-- QuizFlow — Fair Speed Scoring & Strict Coin/Point Separation
-- 1. Adds coin_multiplier column to quiz_sessions.
-- 2. Updates qf_apply_answer with fair continuous speed bonus
--    (up to +50% for fast answers across all difficulties).
-- 3. Ensures point multipliers strictly multiply points, NEVER coins.
-- ================================================================

alter table quiz_sessions add column if not exists coin_multiplier int not null default 1;
alter table quiz_sessions add column if not exists coin_question_index int not null default -1;

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
  v_limit_ms int;
  v_speed_ratio numeric;
  v_speed_bonus numeric;
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

  -- Resolve the actual quiz question index.
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
  v_bid_mult := coalesce(v_row.bid_multiplier, 1);
  v_min_response_ms := coalesce((v_game.config->>'min_response_ms')::int, 100);

  if v_boss_active then
    if v_correct then
      v_points := 0;
      v_coins := coalesce((v_game.config->'difficulty_coins'->>v_difficulty)::int, 10);
      v_new_streak := v_row.streak;
    else
      v_points := -((v_game.config->>'boss_wrong_points')::int);
      v_coins := 0;
      v_new_streak := v_row.streak;
    end if;
  else
    if v_correct then
      v_base := coalesce((v_game.config->'difficulty_points'->>v_difficulty)::numeric, 200);
      v_limit_ms := coalesce((v_game.quiz->'questions'->v_quiz_idx->>'time_limit_ms')::int, 30000);
      
      -- Fair continuous speed bonus: up to +50% points scaled by remaining time
      v_speed_ratio := greatest(0.0, least(1.0, (v_limit_ms - v_elapsed_ms)::numeric / nullif(v_limit_ms, 0)::numeric));
      v_speed_bonus := round(v_base * 0.5 * v_speed_ratio);
      
      -- Streak scaling: +10% per consecutive correct answer up to cap (50%)
      v_streak_mult := 1 + least(
        v_row.streak * (v_game.config->>'streak_step')::numeric,
        (v_game.config->>'streak_cap')::numeric
      );
      
      -- Bid applies to the question: gate multiplier
      v_consume_bid := v_bid_mult > 1 and v_row.bid_question_index < p_question_index;
      
      if v_elapsed_ms < v_min_response_ms then
        v_points := 0; -- suspicious bot
      else
        v_points := round((v_base + v_speed_bonus) * v_streak_mult * greatest(
          case when v_consume_bid then v_bid_mult else 1 end, 1
        ));
      end if;
      
      -- Difficulty coins: strictly difficulty-based, NEVER multiplied by bid points multiplier
      v_coins := coalesce((v_game.config->'difficulty_coins'->>v_difficulty)::int, 10);
      v_new_streak := v_row.streak + 1;
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

  -- Atomic apply
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
    return query select false, 0, 0, 'rejected'; return;
  end if;

  v_points := v_new_points - v_old_points;
  v_coins := v_new_coins - v_old_coins;

  return query select v_correct, v_points, v_coins, 'ok';
end;
$$;

grant execute on function qf_apply_answer(uuid, int, int) to anon, authenticated;
