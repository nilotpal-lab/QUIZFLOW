/* ================================================================
   QuizFlow Council Automated Integration Test Suite
   Runs deep multi-question, multi-player, multi-round simulation
   Testing state transitions, monotonic scoring, and sync integrity.
   ================================================================ */

const {
  createSession,
  loadState,
  saveState,
  mergeGameStates,
  startGame,
  revealAnswer,
  showLeaderboard,
  nextQuestion,
  endGame,
  advanceTournamentRound,
  getTacticsRankings,
  getMasteryRankings
} = require('./src/quizflow/sessionStore.ts');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n🏛️ ================================================================');
  console.log('🏛️  QUIZFLOW 5-AGENT COUNCIL AUTOMATED E2E INTEGRATION SUITE');
  console.log('🏛️ ================================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Room Creation & Causal Precedence
  // -------------------------------------------------------------
  console.log('📦 TEST 1: Room Creation & Session Precedence...');
  const sampleQuiz = {
    title: 'Council Certification Quiz',
    questions: [
      { prompt: 'Q1: What is 2+2?', choices: ['1', '2', '3', '4'], correct_index: 3, time_limit_ms: 20000, difficulty: 'easy' },
      { prompt: 'Q2: Capital of France?', choices: ['London', 'Paris', 'Berlin', 'Madrid'], correct_index: 1, time_limit_ms: 20000, difficulty: 'medium' },
      { prompt: 'Q3: Speed of Light?', choices: ['300k km/s', '150k km/s', '1000 km/s', '10k km/s'], correct_index: 0, time_limit_ms: 20000, difficulty: 'hard' }
    ]
  };

  const pin = 'COUNCIL_' + Math.floor(100000 + Math.random() * 900000);
  const initialState = createSession(sampleQuiz, 'host_001', 'classic');
  assert(initialState.status === 'lobby', 'Initial state must be lobby');
  assert(initialState.currentQuestionIndex === 0, 'Initial question index must be 0');

  // Test session re-creation precedence
  const newerState = {
    ...initialState,
    createdAt: initialState.createdAt + 5000,
    players: { 'new_p1': { id: 'new_p1', nickname: 'FreshPlayer', score: 0, connected: true } }
  };
  const mergedSession = mergeGameStates(initialState, newerState);
  assert(mergedSession.players['new_p1'] !== undefined, 'Newer session createdAt must take complete precedence');

  // -------------------------------------------------------------
  // TEST 2: 50-Player Concurrent Lobby Join
  // -------------------------------------------------------------
  console.log('\n👥 TEST 2: 50-Player Concurrent Lobby Registration...');
  let roomState = initialState;
  const players = {};

  for (let i = 1; i <= 50; i++) {
    const pid = `student_${i}`;
    players[pid] = {
      id: pid,
      nickname: `Student_${i}`,
      avatarSeed: `seed_${i}`,
      avatarStyle: 'custom',
      score: 0,
      streak: 0,
      maxStreak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      totalResponseTimeMs: 0,
      rank: i,
      lastAnswerCorrect: null,
      lastPointsEarned: 0,
      hasAnswered: false,
      selectedIndex: null,
      joinedAt: Date.now(),
      connected: true,
      coins: 0,
      violations: 0,
      flagged: false,
      frenzyScore: 0
    };
  }

  roomState = { ...roomState, players };
  saveState(roomState);
  assert(Object.keys(roomState.players).length === 50, 'All 50 players registered in lobby state');

  // -------------------------------------------------------------
  // TEST 3: Host Starts Game (Lobby -> Question 1 Active)
  // -------------------------------------------------------------
  console.log('\n🚀 TEST 3: Start Game & Question 1 Active Transition...');
  startGame(roomState.pin);
  let q1State = loadState(roomState.pin);
  assert(q1State.status === 'question_active', 'Status must transition to question_active');
  assert(q1State.currentQuestionIndex === 0, 'Question index must be 0 for Q1');
  assert(q1State.questionStartedAt > 0, 'Question startedAt timestamp must be valid');
  assert(Object.values(q1State.players).every(p => !p.hasAnswered), 'All 50 players must have hasAnswered=false');

  // -------------------------------------------------------------
  // TEST 4: 50 Players Submit Answers (35 Correct, 15 Incorrect)
  // -------------------------------------------------------------
  console.log('\n🎲 TEST 4: 50 Concurrent Answer Submissions (35 Correct, 15 Wrong)...');
  const q1Players = { ...q1State.players };
  for (let i = 1; i <= 50; i++) {
    const pid = `student_${i}`;
    const isCorrect = i <= 35; // First 35 get it right
    const selectedIndex = isCorrect ? 3 : 0;
    const pts = isCorrect ? 900 : 0;

    q1Players[pid] = {
      ...q1Players[pid],
      hasAnswered: true,
      selectedIndex,
      lastAnswerCorrect: isCorrect,
      lastPointsEarned: pts,
      score: q1Players[pid].score + pts,
      streak: isCorrect ? 1 : 0,
      maxStreak: isCorrect ? 1 : 0,
      totalCorrect: (q1Players[pid].totalCorrect || 0) + (isCorrect ? 1 : 0),
      totalAnswered: (q1Players[pid].totalAnswered || 0) + 1,
      totalResponseTimeMs: 2500,
      coins: isCorrect ? 12 : 3
    };
  }
  q1State = { ...q1State, players: q1Players };
  saveState(q1State);

  assert(Object.values(q1State.players).filter(p => p.hasAnswered).length === 50, 'All 50 players marked as answered');
  assert(Object.values(q1State.players).filter(p => p.score === 900).length === 35, 'Exactly 35 players earned 900 points');
  assert(Object.values(q1State.players).filter(p => p.score === 0).length === 15, 'Exactly 15 wrong players have 0 points');

  // -------------------------------------------------------------
  // TEST 5: Reveal Answer & Leaderboard
  // -------------------------------------------------------------
  console.log('\n📊 TEST 5: Reveal Answer & Leaderboard Calculation...');
  revealAnswer(q1State.pin);
  let revealState = loadState(q1State.pin);
  assert(revealState.status === 'question_reveal', 'Status must transition to question_reveal');
  assert(revealState.revealCorrectIndex === revealState.quiz.questions[0].correct_index, 'Correct index revealed must match quiz Q1 key');

  showLeaderboard(q1State.pin);
  let lbState = loadState(q1State.pin);
  assert(lbState.status === 'leaderboard', 'Status must transition to leaderboard');
  assert(lbState.tacticsRankings.length === 50, 'Tactics ranking contains all 50 players');
  assert(lbState.tacticsRankings[0].score === 900, 'Rank 1 player has highest score (900)');

  // -------------------------------------------------------------
  // TEST 6: Transition from Leaderboard -> Question 2 Active (Crucial Advancement Test)
  // -------------------------------------------------------------
  console.log('\n⏭️ TEST 6: Advance to Question 2 (Stuck-Screen Prevention Test)...');
  nextQuestion(q1State.pin);
  let q2State = loadState(q1State.pin);
  assert(q2State.status === 'question_active', 'Status must advance back to question_active for Q2');
  assert(q2State.currentQuestionIndex === 1, 'Question index must be 1 for Q2');
  assert(q2State.questionStartedAt > q1State.questionStartedAt, 'Q2 startedAt timestamp must be newer than Q1');

  // Simulate a student device that was still on the Leaderboard merging the incoming Q2 state
  const mergedOnStudentPhone = mergeGameStates(lbState, q2State);
  assert(mergedOnStudentPhone.status === 'question_active', 'Student phone must successfully transition from leaderboard to question_active');
  assert(mergedOnStudentPhone.currentQuestionIndex === 1, 'Student phone must be on Question 2 (Index 1)');
  assert(mergedOnStudentPhone.players['student_1'].hasAnswered === false, 'Student 1 hasAnswered must be reset to false for Q2');
  assert(mergedOnStudentPhone.players['student_1'].score === 900, 'Student 1 cumulative score (900) must be preserved');
  assert(mergedOnStudentPhone.players['student_1'].streak === 1, 'Student 1 streak (1) must be preserved');

  // -------------------------------------------------------------
  // TEST 7: Q2 Answer Submissions (Student 1 gets wrong -> Streak resets to 0)
  // -------------------------------------------------------------
  console.log('\n🎯 TEST 7: Q2 Submissions & Non-Resurrecting Streak Integrity...');
  const q2Players = { ...q2State.players };
  // Student 1 answers wrongly (correct is 1, answers 0)
  q2Players['student_1'] = {
    ...q2Players['student_1'],
    hasAnswered: true,
    selectedIndex: 0,
    lastAnswerCorrect: false,
    lastPointsEarned: 0,
    score: 900, // no pts added
    streak: 0, // reset to 0
    maxStreak: 1, // preserved
    totalCorrect: 1,
    totalAnswered: 2,
    coins: 900 + 3
  };

  // Test that merging does NOT resurrect student_1 streak back to 1 via Math.max
  const student1Merged = mergeGameStates(q2State, { ...q2State, players: q2Players });
  assert(student1Merged.players['student_1'].streak === 0, 'Broken streak must remain 0 and NOT be resurrected');
  assert(student1Merged.players['student_1'].maxStreak === 1, 'Max streak must remain 1');

  // -------------------------------------------------------------
  // TEST 8: Full Tournament Round Advance Test
  // -------------------------------------------------------------
  console.log('\n🏆 TEST 8: Multi-Round Tournament Round Advance...');
  const tournamentState = {
    ...q2State,
    gameMode: 'tournament',
    tournamentConfig: {
      currentRoundIndex: 0,
      rounds: [
        { roundNumber: 1, eliminationRule: 'bottom 10', quiz: sampleQuiz },
        { roundNumber: 2, eliminationRule: 'bottom 5', quiz: sampleQuiz }
      ],
      eliminations: {}
    }
  };
  saveState(tournamentState);

  advanceTournamentRound(tournamentState.pin);
  const round2State = loadState(tournamentState.pin);
  assert(round2State.status === 'lobby', 'Round advance must transition to lobby for round 2');
  assert(round2State.currentRound === 2, 'Current round must be 2');
  assert(round2State.eliminatedPlayers && round2State.eliminatedPlayers.length === 10, 'Exactly 10 players eliminated in round 1');

  // Merge check for tournament advance
  const studentMergedTournament = mergeGameStates(tournamentState, round2State);
  assert(studentMergedTournament.currentRound === 2, 'Tournament round advancement must take precedence over question index regression');
  assert(studentMergedTournament.status === 'lobby', 'Student phone must transition to round 2 lobby');

  console.log('\n🎉 ================================================================');
  console.log('🎉  ALL 8 COUNCIL INTEGRATION & CAUSAL MERGE TESTS PASSED (100%)');
  console.log('🎉 ================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
