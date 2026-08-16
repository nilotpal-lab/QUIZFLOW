const { chromium } = require('@playwright/test');

/* ================================================================
   QuizFlow — 250 Live Student Lobby Joiner
   Connects 250 live student browsers directly to /quizflow/lobby/[pin]
   ================================================================ */

const TARGET_URL = 'https://quizflow-peach.vercel.app';
const ROOM_PIN   = process.env.PIN || '348283';
const TOTAL_STUDENTS = parseInt(process.env.STUDENTS || '250', 10);
const BATCH_SIZE = 10;

async function runStudentBatch(browser, startIdx, count) {
  const tasks = [];

  for (let i = startIdx; i < startIdx + count; i++) {
    const studentIdx = i;
    tasks.push((async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 16_${studentIdx % 50} like Mac OS X) AppleWebKit/605.1.15`
      });

      const page = await context.newPage();
      const playerId = `player_live_250_${studentIdx}_${Date.now()}`;
      const studentName = `MegaStudent_${studentIdx}`;

      try {
        const lobbyUrl = `${TARGET_URL}/quizflow/lobby/${ROOM_PIN}?nickname=${encodeURIComponent(studentName)}&pid=${playerId}&seed=Totoro&style=custom`;
        await page.goto(lobbyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`✅ Student ${studentIdx} (${studentName}) connected!`);
        await page.waitForTimeout(180000); // 3 minutes active connection
      } catch (err) {
        console.error(`❌ Student ${studentIdx} error:`, err.message);
      } finally {
        await context.close().catch(() => {});
      }
    })());

    await new Promise(r => setTimeout(r, 150));
  }

  await Promise.all(tasks);
}

async function main() {
  console.log(`\n🚀 Connecting 250 Live Students to Room PIN: ${ROOM_PIN} on ${TARGET_URL}...\n`);

  const browser = await chromium.launch({ headless: true });

  for (let i = 1; i <= TOTAL_STUDENTS; i += BATCH_SIZE) {
    const currentBatchCount = Math.min(BATCH_SIZE, TOTAL_STUDENTS - i + 1);
    console.log(`📡 Launching batch ${i} to ${i + currentBatchCount - 1}...`);
    runStudentBatch(browser, i, currentBatchCount); // Fire batch in background
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n🎯 All 250 student connections dispatched! Check your Host Screen counter!`);
  await new Promise(r => setTimeout(r, 180000));
  await browser.close();
}

main().catch(console.error);
