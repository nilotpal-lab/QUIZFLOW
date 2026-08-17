import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();

// Desktop: check hydration + card height 96px
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const problems = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (/hydrat|Text content does not match|did not match/i.test(text)) problems.push(text);
});
page.on('pageerror', (err) => {
  if (/hydrat|does not match/i.test(err.message)) problems.push(err.message);
});

await page.goto(`${BASE}/quizflow`, { waitUntil: 'networkidle' });
await page.waitForSelector('.landing-cta-grid', { timeout: 15000 });
await page.waitForTimeout(800); // let hydration finish

ok(problems.length === 0, `no hydration errors on desktop (${problems.length})`);
if (problems.length) console.log(problems[0]);

const desktopHeight = await page.locator('.landing-card').first().evaluate((el) => el.getBoundingClientRect().height);
ok(desktopHeight === 96, `card height ${desktopHeight}px on desktop (compact query inactive)`);

// Landscape phone: compact query should shrink cards to 64px
const land = await browser.newPage({ viewport: { width: 667, height: 375 } });
const landProblems = [];
land.on('console', (msg) => {
  const text = msg.text();
  if (/hydrat|Text content does not match|did not match/i.test(text)) landProblems.push(text);
});
await land.goto(`${BASE}/quizflow`, { waitUntil: 'networkidle' });
await land.waitForSelector('.landing-cta-grid', { timeout: 15000 });
await land.waitForTimeout(800);
ok(landProblems.length === 0, `no hydration errors on landscape phone (${landProblems.length})`);
const landHeight = await land.locator('.landing-card').first().evaluate((el) => el.getBoundingClientRect().height);
ok(landHeight === 64, `card height ${landHeight}px on landscape (compact query active)`);

await browser.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
