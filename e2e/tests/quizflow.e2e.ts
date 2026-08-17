import { test, expect } from '@playwright/test';

// Helper to generate a random nickname
function randomNickname() {
  const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley'];
  return names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(Math.random() * 1000);
}

// Wait until the given question is live on a student's play page, dismiss the
// anti-cheat fullscreen gate if present (enforceFullscreen blocks answer clicks
// until the student enters fullscreen), then pick an answer.
async function answerQuestion(page: any, qIdx: number, totalQ: number, pickRandom: boolean) {
  await page.getByText(new RegExp(`QUESTION ${qIdx} OF ${totalQ}`)).waitFor();
  // The fullscreen-required overlay (z-index 200) intercepts pointer events
  // while `fullscreenActive` is false — enter fullscreen once per page.
  const fsBtn = page.getByRole('button', { name: /Enter Fullscreen/i });
  if (await fsBtn.isVisible().catch(() => false)) {
    await fsBtn.click();
  }
  const btns = page.locator('.answer-btn:not([disabled])');
  await btns.first().waitFor();
  const count = await btns.count();
  const idx = pickRandom ? Math.floor(Math.random() * count) : 0;
  await btns.nth(idx).click();
}

/* ================================================================
   QuizFlow End-to-End Flow (classic PIN + nickname room mode).
   Runs WITHOUT Supabase: the host page auto-seeds preset quizzes
   from localStorage and rooms live in server memory, so the suite
   exercises the real host/join/play UI end to end.

   Phase chain per question (matches src/app/quizflow/host/page.tsx):
     question_active → question_reveal → leaderboard → next question
   The host auto-reveals once everyone has answered (2s after the last
   answer) and auto-paces reveal (4s) -> leaderboard (5s) -> next/end, so
   the tests ride the auto-pacing instead of clicking phase buttons.
   ================================================================ */

test.describe('QuizFlow End‑to‑End Flow', () => {
  // Tests build on each other (game PIN, host + student contexts), so they
  // must run in order inside one worker — never in parallel.
  test.describe.configure({ mode: 'serial' });

  let hostContext: any;
  let studentContexts: any[] = [];
  let hostPage: any;
  let pin: string;
  let totalQ = 1;

  test('Host creates a new game and gets a PIN', async ({ browser }) => {
    hostContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    await hostPage.goto('/host/new');
    // Host the first auto-seeded preset quiz via the per-quiz "Host Now" button
    await hostPage.getByRole('button', { name: /Host Now/i }).first().click();
    // Wait for PIN to appear in a .pin-code element (digits only)
    const pinEl = await hostPage.waitForSelector('.pin-code');
    pin = (await pinEl.textContent()) || '';
    expect(pin).toMatch(/^\d{6}$/);
  });

  test('Multiple students join the same game', async ({ browser }) => {
    // Ensure we have a PIN from previous test
    expect(pin).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/quizflow/join'); // Join screen
      // Enter the 6-digit PIN into the segmented inputs
      for (let d = 0; d < pin.length; d++) {
        await page.locator(`#pin-input-${d}`).fill(pin[d]);
      }
      await page.locator('#player-nickname-input').fill(randomNickname());
      await page.getByRole('button', { name: /Join game arena/i }).click();
      // Wait for lobby redirect (regex tolerates the ?nickname=... query)
      await page.waitForURL(new RegExp(`/lobby/${pin}(\\?|$)`));
      studentContexts.push(ctx);
    }
  });

  test('Host starts first question and students can answer', async () => {
    // Host clicks "Start" — auto-waits until the button is enabled (players joined)
    await hostPage.getByRole('button', { name: /Start Game/i }).click();
    // Wait for the first question card to appear (badge reads "Question 1 of N")
    await hostPage.getByText(/Question 1 of \d+/).waitFor();
    // Read the total question count from the host's badge ("Question 1 of 3")
    const badgeText = await hostPage.getByText(/Question \d+ of \d+/).first().textContent();
    totalQ = parseInt((badgeText || '').match(/of (\d+)/)?.[1] || '1', 10);
    expect(totalQ).toBeGreaterThan(1);
    // For each student, wait for the live question, dismiss the fullscreen
    // anti-cheat gate, and answer
    for (const ctx of studentContexts) {
      const page = ctx.pages()[0]; // the play view
      await answerQuestion(page, 1, totalQ, true);
    }
    // The engine auto-reveals once everyone has answered (2s after the last
    // answer) and auto-paces reveal -> leaderboard -> next question, so Q2
    // appearing on the host proves all answers were recorded and scored.
    await expect.poll(async () => {
      const text = (await hostPage.locator('body').textContent()) || '';
      // Host accuracy card reads "3/3 answered" once all answers landed
      return /3\/3 answered/.test(text);
    }, { timeout: 12000 }).toBeTruthy();
    await hostPage.getByText(/Question 2 of \d+/).waitFor({ timeout: 30000 });
  });

  test('Progress through all questions and reach results page', async () => {
    expect(totalQ).toBeGreaterThan(1);

    // Answer every remaining question as it appears; the host auto-paces
    // through reveal -> leaderboard -> next / end game.
    for (let q = 2; q <= totalQ; q++) {
      for (const ctx of studentContexts) {
        const page = ctx.pages()[0]; // the play view
        await answerQuestion(page, q, totalQ, true);
      }
    }

    // Auto-flow finishes with End Game -> results page
    await hostPage.waitForURL(`**/results?pin=${pin}`, { timeout: 30000 });
    await expect(hostPage.locator('text=FINAL RESULTS')).toBeVisible();
  });

  test.afterAll(async () => {
    // Cleanup: close all contexts
    await hostContext?.close();
    for (const ctx of studentContexts) await ctx.close();
  });
});
