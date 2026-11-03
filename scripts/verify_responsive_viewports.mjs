import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\sahil\\.gemini\\antigravity\\brain\\0c4ff04a-19ad-4a43-ad7a-e1ad1d9ddb11';

const VIEWPORTS = [
  { name: 'resp_small_android_360x640', width: 360, height: 640 },
  { name: 'resp_std_android_390x844', width: 390, height: 844 },
  { name: 'resp_large_mobile_430x932', width: 430, height: 932 },
  { name: 'resp_tablet_768x1024', width: 768, height: 1024 },
  { name: 'resp_desktop_1280x800', width: 1280, height: 800 }
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 1000 });
    await page.goto('https://bhusawal-connect.vercel.app/rider', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const outPath = path.join(ARTIFACT_DIR, `${vp.name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`✓ Captured ${vp.name} (${vp.width}x${vp.height})`);
    await page.close();
  }

  await browser.close();
  console.log('Responsive verification complete!');
}

run().catch(err => {
  console.error('Responsive verification failed:', err);
  process.exit(1);
});
