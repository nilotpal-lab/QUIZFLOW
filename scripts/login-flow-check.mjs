import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

// 1. Landing page: only the two login cards are links
await page.goto(`${BASE}/quizflow`, { waitUntil: 'networkidle' });
await page.waitForSelector('.landing-cta-grid', { timeout: 15000 });

const links = await page.$$eval('a', (as) =>
  as.map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim().replace(/\s+/g, ' ') }))
);
console.log('\n--- Landing page links ---');
links.forEach((l) => console.log(`  ${l.href} :: ${l.text}`));
ok(links.length === 2, `exactly 2 links on landing page (found ${links.length})`);
ok(
  links.some((l) => l.href === '/quizflow/auth' && l.text.includes('Admin Login')),
  'Admin Login card links to /quizflow/auth'
);
ok(
  links.some((l) => l.href === '/quizflow/student/login' && l.text.includes('Student Login')),
  'Student Login card links to /quizflow/student/login'
);

// Header logo must not be a link
const logoLink = await page.$$eval('nav a', (as) => as.length);
ok(logoLink === 0, 'header logo is not a link (only the two cards are links)');

// 2. Admin flow
await page.locator('a[href="/quizflow/auth"]').first().click();
await page.waitForURL('**/quizflow/auth', { timeout: 15000 });
ok(page.url().includes('/quizflow/auth'), `Admin card navigates to ${new URL(page.url()).pathname}`);
const adminVisible = await page.getByText('Admin Login').first().isVisible().catch(() => false);
ok(adminVisible, 'admin auth page renders (Admin Login visible)');

// 3. Student flow
await page.goto(`${BASE}/quizflow`, { waitUntil: 'networkidle' });
await page.locator('a[href="/quizflow/student/login"]').first().click();
await page.waitForURL('**/quizflow/student/login', { timeout: 15000 });
ok(page.url().includes('/quizflow/student/login'), `Student card navigates to ${new URL(page.url()).pathname}`);
const studentVisible = await page.getByText('STUDENT LOGIN').first().isVisible().catch(() => false);
ok(studentVisible, 'student login page renders (STUDENT LOGIN visible)');

await browser.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
