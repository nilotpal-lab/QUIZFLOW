import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const widths = [1024, 1280, 1440, 1920];
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

const intersects = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const browser = await chromium.launch();
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  await page.goto(`${BASE}/quizflow`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.landing-cta-grid', { timeout: 15000 });
  await page.waitForTimeout(300);

  const rects = await page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    };
    const badge = document.querySelector('main section .inline-flex');
    const tagline = document.querySelector('main section p');
    return {
      badge: badge ? r(badge) : null,
      tagline: tagline ? r(tagline) : null,
      shapes: [...document.querySelectorAll('main section .interactive-shape')].map(r),
    };
  });

  let overlapBadge = null;
  let overlapTagline = null;
  for (const s of rects.shapes) {
    if (rects.badge && intersects(s, rects.badge)) overlapBadge = s;
    if (rects.tagline && intersects(s, rects.tagline)) overlapTagline = s;
  }

  console.log(`\n--- width ${w}px ---`);
  ok(!overlapBadge, `no shape overlaps the badge`);
  ok(!overlapTagline, `no shape overlaps the tagline`);
  await page.close();
}
await browser.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
