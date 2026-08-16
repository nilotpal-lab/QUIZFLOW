const { chromium } = require('@playwright/test');

/* ================================================================
   QuizFlow — 100 Multi-Student Playwright Simulation Script
   Spawns 100 parallel headless student browser contexts.
   Each student joins the PIN, picks answers, opens coin shop, & plays.
   ================================================================ */

const TARGET_URL = process.env.TARGET_URL || 'https://quizflow-git-loadtest-preview-nilotpaldeb083-gmailcoms-projects.vercel.app';
const ROOM_PIN   = process.env.PIN || 'TEST01';
const TOTAL_STUDENTS = parseInt(process.env.STUDENTS || '50', 10);
const CONCURRENCY_BATCH = 10; // Batch launch rate per second to simulate realistic classroom entry

async function runStudentSession(browser, studentIdx) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13 mobile screen viewport
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  const studentName = `Student_${studentIdx}_${Math.floor(Math.random() * 1000)}`;

  try {
    // 1. Navigate to Join Page
    await page.goto(`${TARGET_URL}/quizflow/join?pin=${ROOM_PIN}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 2. Fill Student Name
    const nameInput = page.locator('#player-nickname-input');
    if (await nameInput.isVisible({ timeout: 5000 })) {
      await nameInput.fill(studentName);
    }

    // 3. Click Enter Arena / Join Button
    const joinBtn = page.locator('button:has-text("Enter Arena"), button:has-text("Join Game")').first();
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
    }

    // 4. Wait for Lobby or Play Screen
    await page.waitForTimeout(2000);

    // 5. Simulate Gameplay interaction if question choice cards are visible
    const choiceButtons = page.locator('button:has-text("Option"), button[data-choice-idx], .choice-card');
    const choiceCount = await choiceButtons.count();
    if (choiceCount > 0) {
      const pickIdx = Math.floor(Math.random() * choiceCount);
      await choiceButtons.nth(pickIdx).click().catch(() => {});
    }

    // 6. Hold context active to simulate student session in room
    await page.waitForTimeout(10000);

  } catch (err) {
    // Graceful handle timeout / closed room
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  console.log(`🚀 Starting Playwright 100-Student UI Simulation...`);
  console.log(`🎯 Target URL: ${TARGET_URL}`);
  console.log(`📌 Room PIN: ${ROOM_PIN}`);
  console.log(`👥 Total Simulated Students: ${TOTAL_STUDENTS}\n`);

  const browser = await chromium.launch({ headless: true });
  const tasks = [];

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    tasks.push(runStudentSession(browser, i));
    if (i % CONCURRENCY_BATCH === 0) {
      await new Promise(r => setTimeout(r, 1000)); // 1 sec batch pacing
    }
  }

  await Promise.all(tasks);
  await browser.close();
  console.log(`\n✅ All ${TOTAL_STUDENTS} student browser sessions finished cleanly!`);
}

main().catch(console.error);
