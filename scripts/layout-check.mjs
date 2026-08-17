import { chromium } from 'playwright';

const URL = 'http://localhost:3001/quizflow';
const viewports = [
  { name: 'desktop-lg', width: 1440, height: 900 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'laptop-hd', width: 1366, height: 768 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone-lg', width: 390, height: 844 },
  { name: 'phone', width: 375, height: 667 },
  { name: 'phone-landscape', width: 667, height: 375 },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.landing-cta-grid', { timeout: 15000 });

  const m = await page.evaluate(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const de = document.documentElement;
    const cta = document.querySelector('.landing-cta-grid').getBoundingClientRect();
    const badge = document.querySelector('main section .inline-flex')?.getBoundingClientRect();
    const title = document.querySelector('main section h1')?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      scrollHeight: de.scrollHeight,
      navBottom: q('nav')?.bottom,
      badgeTop: badge ? Math.round(badge.top) : null,
      titleTop: title ? Math.round(title.top) : null,
      ctaBottom: Math.round(cta.bottom),
      ctaTop: Math.round(cta.top),
      bodyScrollWidth: document.body.scrollWidth,
    };
  });

  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const clipped = m.ctaBottom > m.innerHeight;
  const bottomGap = m.innerHeight - m.ctaBottom;
  console.log(`content bottom (CTA grid) = ${m.ctaBottom}px vs viewport ${m.innerHeight}px`);
  if (!clipped) {
    console.log(`=> ALL CONTENT VISIBLE, ${bottomGap}px slack below CTA ✓`);
  } else {
    console.log(`=> CLIPPED by ${m.ctaBottom - m.innerHeight}px`);
  }
  await page.screenshot({ path: `C:/tmp/landing-${vp.name}.png`, fullPage: false });
  await page.close();
}
await browser.close();
