-- ================================================================
-- QuizFlow — Reveal-phase answer key accessor
--
-- game_answer_keys is intentionally NOT granted to anon/authenticated
-- (see 20260815090000_add_live_play_game_engine.sql). The team-facing
-- game-state route needs the CURRENT question's answer only once the
-- room reaches question_reveal / ended. Expose that via a SECURITY
-- DEFINER accessor rather than weakening the table grants.
-- ================================================================

create or replace function qf_get_answer_key(p_game_id text, p_question_index int)
returns table (correct_index int)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select k.correct_index
    from game_answer_keys k
    where k.game_id = p_game_id and k.question_index = p_question_index;
end;
$$;

grant execute on function qf_get_answer_key(text, int) to anon, authenticated;
