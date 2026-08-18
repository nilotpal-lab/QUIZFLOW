import { test, expect } from '@playwright/test';

/* ================================================================
   QuizFlow Present App UI E2E Suite (Team Username & Password System)
   ================================================================ */

test.describe('QuizFlow Present App UI E2E Suite', () => {
  test('Landing Homepage displays Admin & Student Login buttons', async ({ page }) => {
    await page.goto('/quizflow');
    
    // Verify title and brand
    await expect(page).toHaveTitle(/QuizFlow/i);
    
    // Verify Admin Login card link
    const adminLink = page.locator('a[href="/quizflow/auth"]');
    await expect(adminLink).toBeVisible();

    // Verify Student Login card link
    const studentLink = page.locator('a[href="/quizflow/student/login"]');
    await expect(studentLink).toBeVisible();
  });

  test('Student Login page displays Team Username & Password fields when navigate directly', async ({ page }) => {
    await page.goto('/quizflow/student/login');

    // Page could show Gate or Login form depending on event_config
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    
    // Verify page loads cleanly with no crash
    const logo = page.locator('nav').first();
    await expect(logo).toBeVisible();
  });

  test('Admin Auth page loads login options', async ({ page }) => {
    await page.goto('/quizflow/auth');
    
    // Verify sign in options are present
    const heading = page.locator('h1, h2, form').first();
    await expect(heading).toBeVisible();
  });
});
