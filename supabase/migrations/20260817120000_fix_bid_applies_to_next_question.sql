-- ================================================================
-- QuizFlow — Fix: bid multiplier must only apply to the FIRST
-- question after purchase.
--
-- In qf_apply_answer (20260815090000) the correct-answer points used
-- v_bid_mult unconditionally, while v_consume_bid only controlled
-- whether the bid was RESET afterwards. A bid_2x bought DURING Q1
-- therefore doubled Q1's points (200 instead of 100) AND still fired
-- on Q2 — the opposite of the documented "applies to the NEXT
-- question" contract. The multiplier is now gated by v_consume_bid
-- (bid purchased before this question started).
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
      -- Bid applies ONLY to the first question after purchase: it must have
      -- been bought BEFORE this question started (lobby purchases record -1,
      -- which precedes every question). Gate the multiplier by v_consume_bid —
      -- otherwise a bid bought during Q1 doubles Q1 AND still fires on Q2.
      v_consume_bid := v_bid_mult > 1
                       and v_row.bid_question_index < p_question_index;
      if v_elapsed_ms < v_min_response_ms then
        v_points := 0; -- suspicious-bot: log-only, soft mode
      else
        v_points := round(v_base * v_streak_mult * greatest(
          case when v_consume_bid then v_bid_mult else 1 end, 1
        ));
      end if;
      v_coins := (v_game.config->'difficulty_coins'->>v_difficulty)::int;
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
