const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcLogoPath = path.join(projectRoot, 'Logo', 'ChatGPT Image Aug 17, 2026, 10_45_06 AM.png');

if (!fs.existsSync(srcLogoPath)) {
  console.error('Logo file not found at:', srcLogoPath);
  process.exit(1);
}

const imgBuffer = fs.readFileSync(srcLogoPath);
console.log('Read logo file:', imgBuffer.length, 'bytes');

async function main() {
  // 1. Copy to public/
  const publicTargets = [
    'logo.png',
    'quizflow-logo.png',
    'favicon.png',
    'favicon.ico',
    'icon.png',
    'apple-icon.png',
    'apple-touch-icon.png'
  ];

  publicTargets.forEach(target => {
    const dest = path.join(projectRoot, 'public', target);
    fs.writeFileSync(dest, imgBuffer);
    console.log('Written to:', dest);
  });

  // 2. Copy to src/app/ for Next.js App Router metadata conventions
  const appTargets = [
    'icon.png',
    'apple-icon.png',
    'favicon.ico'
  ];

  appTargets.forEach(target => {
    const dest = path.join(projectRoot, 'src', 'app', target);
    fs.writeFileSync(dest, imgBuffer);
    console.log('Written to:', dest);
  });

  // 3. Generate Base64 Data URI for src/quizflow/logoDataUri.ts
  // IMPORTANT: the OG image runs as a Vercel Edge Function (1 MB bundle limit),
  // so the data URI must be a SMALL downscaled render of the logo — NOT the full
  // 1254x1254 source (942 KB, C2PA-signed). We downscale on a canvas via
  // Playwright's Chromium (also strips embedded C2PA/metadata bloat).
  const base64 = imgBuffer.toString('base64');
  const dataUri = await generateSmallDataUri(base64);

  const logoDataUriContent = `/* AUTO-GENERATED from Logo/ChatGPT Image Aug 17, 2026, 10_45_06 AM.png — do not edit by hand. */
/* Base64 data URI of the QuizFlow logo (96x96 downscaled), used by the edge-rendered OG image. */
export const QUIZFLOW_LOGO_DATA_URI: string = "${dataUri}";
`;

  const dataUriFile = path.join(projectRoot, 'src', 'quizflow', 'logoDataUri.ts');
  fs.writeFileSync(dataUriFile, logoDataUriContent, 'utf8');
  console.log('Written to:', dataUriFile, 'Total size:', logoDataUriContent.length, 'characters');
}

async function generateSmallDataUri(base64) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<img id="logo" src="data:image/png;base64,${base64}" alt="">`);
    const dataUri = await page.evaluate(async (size) => {
      const img = document.getElementById('logo');
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    }, 96);
    return dataUri;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
