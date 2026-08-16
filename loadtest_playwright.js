const { chromium } = require('@playwright/test');

/* ================================================================
   QuizFlow — Full Active Gameplay Playwright Student Generator
   Joins room AND automatically submits random A/B/C/D answers on active questions!
   ================================================================ */

const TARGET_URL = 'https://quizflow-peach.vercel.app';
const ROOM_PIN   = process.env.PIN || '842091';
const TOTAL_STUDENTS = parseInt(process.env.STUDENTS || '50', 10);
const HOLD_MS    = parseInt(process.env.HOLD_MS || '300000', 10); // Hold open for 5 minutes during full game

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
            const randomOption = Math.floor(Math.random() * 4); // Random A=0, B=1, C=2, D=3
            const randomTimeRemaining = Math.floor(5000 + Math.random() * 15000);

            // Submit answer via API
            await page.request.post(`${TARGET_URL}/api/room/${ROOM_PIN}`, {
              data: {
                action: 'submit_answer',
                playerId: playerId,
                selectedIndex: randomOption,
                timeRemainingMs: randomTimeRemaining
              },
              headers: { 'Content-Type': 'application/json' }
            }).catch(() => {});

            console.log(`🎲 Student ${studentIdx} (${studentName}) answered Q${lastAnsweredQuestionIdx + 1} with Option ${['A','B','C','D'][randomOption]}!`);
          }
        }
      } catch {}

      await page.waitForTimeout(1500); // 1.5s poll loop during gameplay
    }

  } catch (err) {
    console.error(`❌ Student ${studentIdx} error:`, err.message);
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  console.log(`\n🚀 Starting Full Active Gameplay Playwright Test (${TOTAL_STUDENTS} Students)...`);
  console.log(`📌 Room PIN: ${ROOM_PIN}`);
  console.log(`🎯 Target URL: ${TARGET_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const tasks = [];

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    tasks.push(joinAndPlayStudent(browser, i));
    await new Promise(r => setTimeout(r, 200)); // 200ms join pacing
  }

  await Promise.all(tasks);
  await browser.close();
  console.log(`\n✅ Gameplay test completed for all ${TOTAL_STUDENTS} students!`);
}

main().catch(console.error);
