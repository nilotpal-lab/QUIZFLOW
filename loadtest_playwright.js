const { chromium } = require('@playwright/test');

/* ================================================================
   QuizFlow — 50 Active Gameplay Playwright Students
   Joins room PIN, stays in lobby, and plays the quiz live on start!
   ================================================================ */

const TARGET_URL = 'https://quizflow-peach.vercel.app';
const ROOM_PIN   = process.env.PIN || '776163';
const TOTAL_STUDENTS = parseInt(process.env.STUDENTS || '50', 10);
const HOLD_MS    = parseInt(process.env.HOLD_MS || '300000', 10); // 5 minutes

async function joinAndPlayStudent(browser, studentIdx) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 16_${studentIdx % 50} like Mac OS X) AppleWebKit/605.1.15`
  });

  const page = await context.newPage();
  const playerId = `player_game_${studentIdx}_${Date.now()}`;
  const studentName = `GamerStudent_${studentIdx}`;

  try {
    // 1. Prime Server RAM via API
    await page.request.post(`${TARGET_URL}/api/room/${ROOM_PIN}`, {
      data: {
        action: 'join',
        player: {
          id: playerId,
          nickname: studentName,
          avatarSeed: 'Totoro',
          avatarStyle: 'custom',
          joinedAt: Date.now(),
          connected: true,
          score: 0
        }
      },
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});

    // 2. Open Lobby Page to establish Realtime WebSocket connection
    const lobbyUrl = `${TARGET_URL}/quizflow/lobby/${ROOM_PIN}?nickname=${encodeURIComponent(studentName)}&pid=${playerId}&seed=Totoro&style=custom`;
    await page.goto(lobbyUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

    console.log(`✅ Student ${studentIdx} (${studentName}) joined room ${ROOM_PIN}!`);

    // 3. Active Gameplay Loop: Poll for question_active and submit random answers (A, B, C, D)
    const startTime = Date.now();
    let lastAnsweredQuestionIdx = -1;

    while (Date.now() - startTime < HOLD_MS) {
      try {
        const stateRes = await page.request.get(`${TARGET_URL}/api/room/${ROOM_PIN}?_t=${Date.now()}`);
        if (stateRes.ok()) {
          const body = await stateRes.json().catch(() => ({}));
          const state = body?.state;

          if (state?.status === 'question_active' && state?.currentQuestionIndex !== lastAnsweredQuestionIdx) {
            lastAnsweredQuestionIdx = state.currentQuestionIndex;
            const randomOption = Math.floor(Math.random() * 4); // Random Option A=0, B=1, C=2, D=3
            const randomResponseTimeMs = Math.floor(1200 + Math.random() * 4000); // 1.2s to 5.2s response time
            const randomTimeRemaining = Math.max(1000, 20000 - randomResponseTimeMs);

            // Wait a realistic student reaction delay before clicking
            await page.waitForTimeout(Math.min(2500, randomResponseTimeMs / 2));

            // Submit answer via API
            await page.request.post(`${TARGET_URL}/api/room/${ROOM_PIN}`, {
              data: {
                action: 'submit_answer',
                playerId: playerId,
                selectedIndex: randomOption,
                timeRemainingMs: randomTimeRemaining,
                responseTimeMs: randomResponseTimeMs
              },
              headers: { 'Content-Type': 'application/json' }
            }).catch(() => {});

            console.log(`🎲 Student ${studentIdx} (${studentName}) answered Q${lastAnsweredQuestionIdx + 1} with Option ${['A','B','C','D'][randomOption]}!`);
          }
        }
      } catch {}

      await page.waitForTimeout(600); // Fast 600ms poll loop
    }

  } catch (err) {
    console.error(`❌ Student ${studentIdx} error:`, err.message);
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  console.log(`\n🚀 Starting 50 Active Gameplay Students for Room PIN: ${ROOM_PIN}...`);
  console.log(`🎯 Target URL: ${TARGET_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const tasks = [];

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    tasks.push(joinAndPlayStudent(browser, i));
    await new Promise(r => setTimeout(r, 150)); // 150ms join pacing
  }

  await Promise.all(tasks);
  await browser.close();
  console.log(`\n✅ Gameplay test completed for all ${TOTAL_STUDENTS} students!`);
}

main().catch(console.error);
