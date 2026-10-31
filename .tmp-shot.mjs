import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = process.argv[2] || '/tmp/veslo-shot.png';
const width = Number(process.argv[3] || 1336);
const height = Number(process.argv[4] || 733);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
await page.click('#start-btn');
await new Promise((r) => setTimeout(r, 3500));

await page.screenshot({ path: out });
await browser.close();
