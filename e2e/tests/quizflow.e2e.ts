import { test, expect } from '@playwright/test';

// Helper to generate a random nickname
function randomNickname() {
  const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley'];
  return names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(Math.random()*1000);
}

test.describe('QuizFlow End‑to‑End Flow', () => {
  let hostContext: any;
  let studentContexts: any[] = [];
  let hostPage: any;
  let pin: string;

  test('Host creates a new game and gets a PIN', async ({ browser }) => {
    hostContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    await hostPage.goto('/host/new');
    // Click the "Create & Host" button (assumes a button with text "Publish & Host")
    await hostPage.getByRole('button', { name: /Publish & Host/i }).click();
    // Wait for PIN to appear in a .pin-display element
    const pinEl = await hostPage.waitForSelector('.pin-display');
    pin = await pinEl.textContent();
    expect(pin).toMatch(/^\d{6}$/);
  });

  test('Multiple students join the same game', async ({ browser }) => {
    // Ensure we have a PIN from previous test
    expect(pin).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/'); // Home join screen
      await page.getByPlaceholder('Enter PIN').fill(pin!);
      await page.getByPlaceholder('Enter nickname').fill(randomNickname());
      await page.getByRole('button', { name: /Join/i }).click();
      // Wait for lobby redirect
      await page.waitForURL(`**/lobby/${pin}`);
      studentContexts.push(ctx);
    }
  });

  test('Host starts first question and students can answer', async () => {
    // Host clicks "Start" (assumes button text "Start Game")
    await hostPage.getByRole('button', { name: /Start Game/i }).click();
    // Wait for first question card to appear
    await hostPage.waitForSelector('.question-card');
    // For each student, answer the first choice
    for (const ctx of studentContexts) {
      const page = await ctx.newPage();
      await page.waitForSelector('.answer-btn');
      const firstChoice = await page.$('.answer-btn');
      await firstChoice?.click();
    }
    // Host reveals answer
    await hostPage.getByRole('button', { name: /Reveal Answer/i }).click();
    // Verify leaderboard updates (at least one score > 0)
    const scores = await hostPage.$$eval('.lb-row .score', (els: Element[]) => els.map(e => parseInt(e.textContent || '0')));
    expect(scores.some((s: number) => s > 0)).toBeTruthy();
  });

  test('Progress through all questions and reach results page', async () => {
    // Loop through remaining questions (assume max 5)
    for (let q = 1; q < 5; q++) {
      await hostPage.getByRole('button', { name: /Next Question/i }).click();
      await hostPage.waitForSelector('.question-card');
      // Students answer again (reuse existing pages)
      for (const ctx of studentContexts) {
        const pages = ctx.pages();
        const page = pages[pages.length - 1]; // last page is the play view
        await page.waitForSelector('.answer-btn');
        const btns = await page.$$('.answer-btn');
        // Randomly pick one (to also test randomization)
        const idx = Math.floor(Math.random() * btns.length);
        await btns[idx].click();
      }
      await hostPage.getByRole('button', { name: /Reveal Answer/i }).click();
    }
    // End game
    await hostPage.getByRole('button', { name: /End Game/i }).click();
    // Verify navigation to results page
    await hostPage.waitForURL(`**/results?pin=${pin}`);
    await expect(hostPage.locator('text=FINAL RESULTS')).toBeVisible();
  });

  test('Host profile update propagates instantly', async () => {
    // Open a second host tab to verify sync
    const secondHost = await hostContext.browser().newContext();
    const secondPage = await secondHost.newPage();
    await secondPage.goto('/host');
    await secondPage.waitForURL(`**/host?pin=${pin}`);
    // Change host nickname in first tab
    await hostPage.getByPlaceholder('Host name').fill('NewHostName');
    await hostPage.getByRole('button', { name: /Save Profile/i }).click();
    // Verify the name updates in second tab
    await expect(secondPage.locator('.host-name')).toHaveText('NewHostName');
    await secondHost.close();
  });

  test.afterAll(async () => {
    // Cleanup: close all contexts
    await hostContext.close();
    for (const ctx of studentContexts) await ctx.close();
  });
});
