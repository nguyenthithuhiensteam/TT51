import { chromium } from 'playwright';
import { normalizePlanType } from '../electron/plan-schema.cjs';

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    const launchOptions = { args: ['--no-sandbox'] };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    browserPromise = chromium.launch(launchOptions);
  }
  return browserPromise;
}

/**
 * Thay thế `BrowserWindow.webContents.printToPDF` của Electron: dùng Chromium ẩn (Playwright) để in
 * đúng HTML kế hoạch (`createPlanHtml`) ra PDF thật trên máy chủ — không chụp ảnh giao diện.
 */
export async function renderPlanPdf(html, plan) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    const landscape = normalizePlanType(plan.level) !== 'lesson';
    return await page.pdf({ format: 'A4', landscape, printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  } finally {
    await page.close();
  }
}

export async function closePdfEngine() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
