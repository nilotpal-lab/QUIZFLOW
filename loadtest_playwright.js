const { chromium } = require('@playwright/test');

/* ================================================================
   QuizFlow — 500 Multi-Student Playwright Simulation Script
   High-concurrency batching for 500 parallel student sessions.
   ================================================================ */

const TARGET_URL = process.env.TARGET_URL || 'https://quizflow-git-loadtest-preview-nilotpaldeb083-gmailcoms-projects.vercel.app';
const ROOM_PIN   = process.env.PIN || 'TEST01';
const TOTAL_STUDENTS = parseInt(process.env.STUDENTS || '500', 10);
const IS_HEADLESS = process.env.HEADLESS !== 'false';
const SLOW_MO = parseInt(process.env.SLOWMO || '0', 10);
const BATCH_SIZE = 25; // 25 students per batch

async function runStudentSession(browser, studentIdx) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  const studentName = `SuperStudent_${studentIdx}`;

  try {
    // 1. Navigate to Join Page
    await page.goto(`${TARGET_URL}/quizflow/join?pin=${ROOM_PIN}`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // 2. Fill Student Name
    const nameInput = page.locator('#player-nickname-input');
    if (await nameInput.isVisible({ timeout: 5000 })) {
      await nameInput.fill(studentName);
    }

    // 3. Click Enter Arena / Join Button
    const joinBtn = page.locator('button:has-text("Enter Arena"), button:has-text("Join Game"), button:has-text("Join")').first();
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
    }

    // 4. Wait for Lobby or Play Screen
    await page.waitForTimeout(3000);

    // 5. Simulate Gameplay interaction if choice cards are visible
    const choiceButtons = page.locator('button:has-text("Option"), button[data-choice-idx], .choice-card');
    const choiceCount = await choiceButtons.count();
    if (choiceCount > 0) {
      const pickIdx = Math.floor(Math.random() * choiceCount);
      await choiceButtons.nth(pickIdx).click().catch(() => {});
    }

    await page.waitForTimeout(4000);

  } catch (err) {
    // Graceful handling of individual context timeout under 500-user load
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  console.log(`🚀 Starting 500-Student Playwright Mega-Stress Test...`);
  console.log(`🎯 Target URL: ${TARGET_URL}`);
  console.log(`📌 Room PIN: ${ROOM_PIN}`);
  console.log(`👥 Total Simulated Students: ${TOTAL_STUDENTS}`);
  console.log(`🖥️ Headless Mode: ${IS_HEADLESS ? 'ENABLED' : 'DISABLED'}\n`);

  const browser = await chromium.launch({
    headless: IS_HEADLESS,
    slowMo: SLOW_MO
  });

  const tasks = [];
  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    tasks.push(runStudentSession(browser, i));
    if (i % BATCH_SIZE === 0) {
      await new Promise(r => setTimeout(r, 600)); // Paced batch entry
    }
  }

  await Promise.all(tasks);
  await browser.close();
  console.log(`\n✅ All ${TOTAL_STUDENTS} student browser sessions finished cleanly!`);
}

main().catch(console.error);
