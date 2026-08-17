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
const base64 = imgBuffer.toString('base64');
const dataUri = 'data:image/png;base64,' + base64;

const logoDataUriContent = `/* AUTO-GENERATED from Logo/ChatGPT Image Aug 17, 2026, 10_45_06 AM.png — do not edit by hand. */
/* Base64 data URI of the QuizFlow logo, used by the edge-rendered OG image. */
export const QUIZFLOW_LOGO_DATA_URI: string = "${dataUri}";
`;

const dataUriFile = path.join(projectRoot, 'src', 'quizflow', 'logoDataUri.ts');
fs.writeFileSync(dataUriFile, logoDataUriContent, 'utf8');
console.log('Written to:', dataUriFile, 'Total size:', logoDataUriContent.length, 'characters');
