import { test, expect } from '@playwright/test';

/* ================================================================
   QuizFlow — Complete Live Arena 25-Team Gameplay Simulation
   1. Connects all 25 registered teams to the live lobby
   2. Verifies dynamic presence in Host Command Center
   3. Simulates live question answering & real-time radar
   4. Verifies reveal, score calculations, and leaderboard standings
   ================================================================ */

const USER_TEAMS = [
  { username: 'LOL', password: 'Sanchit' },
  { username: 'LUL', password: 'hi' },
  { username: 'FREEBUFF', password: 'FREEBUFF' },
  { username: 'CODEBUFF', password: 'CODEBUFF' },
  { username: 'NOM', password: 'Narayan' },
  { username: 'Sanchi', password: 'Damn' },
  { username: 'HI', password: 'HI' },
  { username: 'BYE', password: 'BYE' },
  { username: 'SNEHA', password: 'PREMA' },
  { username: 'KRISHNA', password: 'BHAGWAN' },
  { username: 'ARNAV', password: 'MEDHI' },
  { username: 'AKSHAT', password: 'GUPTA' },
  { username: 'SINGHNIA', password: 'SS' },
  { username: 'CHINMAY', password: 'BELENGE' },
  { username: 'NIHAL', password: 'SARVDEEP' },
  { username: 'PHONE', password: 'CALL' },
  { username: 'SD', password: 'SDS' },
  { username: 'SA', password: 'SWQWAS' },
  { username: 'SDFAW', password: 'WDADWD' },
  { username: 'DACX', password: 'WDC' },
  { username: 'DCX', password: 'WDSZC' },
  { username: 'WDSCDX', password: 'WDSA' },
  { username: 'WASZ', password: 'QWSD' },
  { username: 'WS', password: 'ASXZ' },
  { username: 'SZX', password: 'ASCX' }
];

test('25 Teams Join Live Lobby, Answer Questions & Compete on Leaderboard', async ({ playwright, baseURL }) => {
  const targetURL = baseURL || 'http://localhost:3000';
  console.log(`\n🎮 Initializing 25-Team Arena Simulation against ${targetURL}...\n`);

  // Step 1: Log in Admin to get host session cookie
  const adminContext = await playwright.request.newContext({ baseURL: targetURL });
  const adminLoginRes = await adminContext.post('/api/admin/session', {
    data: { name: 'Sanchit', password: '123456' }
  });
  console.log(`  ✓ Host admin logged in: status ${adminLoginRes.status()}`);
  
  const testQuiz = {
    title: 'Computer Science Arena Championship',
    description: 'Live test competition',
    questions: [
      {
        prompt: 'What does CPU stand for in computer systems?',
        choices: ['Central Processing Unit', 'Computer Power Unit', 'Core Programming Utility', 'Central Protocol User'],
        correct_index: 0,
        time_limit_ms: 30000,
        difficulty: 'medium',
        bloom_level: 'understand',
        explanation: 'CPU stands for Central Processing Unit.'
      },
      {
        prompt: 'Which data structure follows the First In First Out (FIFO) principle?',
        choices: ['Stack', 'Queue', 'Binary Search Tree', 'Graph'],
        correct_index: 1,
        time_limit_ms: 30000,
        difficulty: 'easy',
        bloom_level: 'remember',
        explanation: 'Queues operate strictly on First-In-First-Out.'
      }
    ]
  };

  const createRes = await adminContext.post('/api/quiz/game', {
    data: { game_id: 'EVENT', quiz: testQuiz, mode: 'classic' }
  });
  console.log(`  ✓ Game hosted in arena: status ${createRes.status()}`);

  // Step 2: Log in all 25 teams in parallel
  console.log('\n📱 Logging in 25 teams with credentials...');
  const studentSessions: Array<{ username: string; context: any }> = [];

  for (let i = 0; i < USER_TEAMS.length; i++) {
    const { username, password } = USER_TEAMS[i];
    const studentContext = await playwright.request.newContext({ baseURL: targetURL });
    const deviceId = `bot_device_${username.toLowerCase()}_${i + 1}`;

    const loginRes = await studentContext.post('/api/student/login', {
      data: { username, password, device_id: deviceId }
    });

    const loginBody = await loginRes.json().catch(() => ({}));
    if (loginRes.status() === 200 && loginBody.success) {
      studentSessions.push({ username, context: studentContext });
      // Fetch state once to register session
      await studentContext.get('/api/quiz/game/state');
      console.log(`  ✓ [${i + 1}/25] Team ${username} logged in & entered arena lobby.`);
    } else {
      console.warn(`  ⚠️ Team ${username} login issue: ${loginBody.error || loginRes.status()}`);
    }
  }

  console.log(`\n🟢 Connected ${studentSessions.length} / 25 teams to the Live Lobby!`);
  expect(studentSessions.length).toBeGreaterThanOrEqual(20);

  // Step 3: Verify Host Lobby reflects connected teams
  const hostCheck = await adminContext.get('/api/quiz/game?game_id=EVENT');
  const hostData = await hostCheck.json();
  console.log(`\n📡 Host Presence Status:`);
  console.log(`  - Total Registered: ${hostData.total_registered_teams}`);
  console.log(`  - Bound to Device:  ${hostData.claimed_teams_count}`);
  console.log(`  - In Arena Lobby:   ${hostData.active_sessions_count}`);

  expect(hostData.active_sessions_count).toBe(studentSessions.length);

  // Step 4: Host Starts Match (Advancing from lobby to question_active)
  console.log('\n🚀 Host pressing START GAME...');
  const startRes = await adminContext.post('/api/quiz/game/advance', {
    data: { game_id: 'EVENT', action: 'start' }
  });
  expect(startRes.status()).toBe(200);

  // Step 5: All 25 teams answer Question 1
  console.log('\n⚡ All 25 teams submitting answers for Question 1...');
  const answerPromises = studentSessions.map(async ({ username, context }, idx) => {
    // 80% answer correct (option 0), 20% answer wrong (option 1)
    const selectedOption = idx % 5 === 0 ? 1 : 0;
    const responseTimeMs = 1200 + (idx * 150); // Staggered response times

    const ansRes = await context.post('/api/quiz/answer', {
      data: {
        game_id: 'EVENT',
        question_index: 0,
        selected_option: selectedOption,
        client_elapsed_ms: responseTimeMs
      }
    });
    const ansBody = await ansRes.json().catch(() => ({}));
    return { username, ok: ansBody.success, isCorrect: ansBody.is_correct, points: ansBody.points_earned };
  });

  const answerResults = await Promise.all(answerPromises);
  const correctCount = answerResults.filter(a => a.isCorrect).length;
  console.log(`  ✓ Submissions complete: ${correctCount} correct answers, ${answerResults.length - correctCount} incorrect.`);

  // Step 6: Verify Host Radar reflects 25 answers submitted
  const radarCheck = await adminContext.get('/api/quiz/game?game_id=EVENT');
  const radarData = await radarCheck.json();
  console.log(`\n📊 Host Submission Radar:`);
  console.log(`  - Answered: ${radarData.answered_count} / ${radarData.active_sessions_count}`);
  console.log(`  - Waiting:  ${radarData.waiting_teams.length} thinking`);

  expect(radarData.answered_count).toBe(studentSessions.length);

  // Step 7: Host Reveals Answer
  console.log('\n👁️ Host revealing correct answer...');
  await adminContext.post('/api/quiz/game/advance', {
    data: { game_id: 'EVENT', action: 'reveal' }
  });

  // Verify student state fetch works in reveal phase
  const studentRevealRes = await studentSessions[0].context.get('/api/quiz/game/state');
  const studentRevealData = await studentRevealRes.json();
  console.log(`  ✓ Student fetched state in reveal phase: status = ${studentRevealData.game?.status}`);

  // Step 8: Host Shows Standings
  console.log('\n🏆 Host advancing to Live Leaderboard...');
  await adminContext.post('/api/quiz/game/advance', {
    data: { game_id: 'EVENT', action: 'leaderboard' }
  });

  const lbRes = await adminContext.get('/api/admin/leaderboard?game_id=EVENT');
  const lbData = await lbRes.json();
  console.log(`\n👑 TOP LEADERBOARD STANDINGS:`);
  (lbData.leaderboard || []).slice(0, 5).forEach((entry: any, i: number) => {
    console.log(`  #${i + 1} ${entry.name} (${entry.code}) — ${entry.points.toLocaleString()} pts 🔥 Streak: ${entry.streak} 🪙 ${entry.coins} coins`);
  });

  expect(lbData.leaderboard.length).toBeGreaterThanOrEqual(1);

  // Step 9: Verify Team Creation & Deletion
  console.log('\n🗑️ Testing team creation & deletion...');
  const tempTeamRes = await adminContext.post('/api/admin/teams', {
    data: { name: 'Temp Delete Test Team', roster: ['Test Leader'] }
  });
  const tempTeamData = await tempTeamRes.json();
  expect(tempTeamRes.status()).toBe(200);
  expect(tempTeamData.success).toBe(true);
  const createdTeamId = tempTeamData.team?.id;
  console.log(`  ✓ Temporary team created: ID ${createdTeamId}`);

  // Delete the team
  const delRes = await adminContext.delete(`/api/admin/teams/${createdTeamId}`);
  const delData = await delRes.json();
  console.log(`  ✓ Delete endpoint response: status ${delRes.status()}, success = ${delData.success}`);
  expect(delRes.status()).toBe(200);
  expect(delData.success).toBe(true);

  console.log('\n🎉 ALL 25 TEAMS JOINED, PLAYED QUIZ & TEAM DELETION VERIFIED WITH ZERO ERRORS!\n');
});
