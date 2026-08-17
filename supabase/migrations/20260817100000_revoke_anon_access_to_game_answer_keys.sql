-- ================================================================
-- QuizFlow — Security fix: game_answer_keys must be server-only.
--
-- The cloud project auto-exposed this table to the Data API roles
-- (legacy auto-expose behavior), so `anon` could SELECT/DELETE the
-- correct-answer indices. The live-play security model (see
-- 20260815090000_add_live_play_game_engine.sql) requires it to be
-- readable ONLY by the SECURITY DEFINER qf_* functions — a client
-- holding the anon key must never see correct answers.
-- ================================================================

revoke all on table game_answer_keys from anon, authenticated;
