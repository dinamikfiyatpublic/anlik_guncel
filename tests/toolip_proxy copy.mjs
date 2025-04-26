import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Stealth eklentisi
puppeteer.use(StealthPlugin());

const proxyHost = 'proxy.toolip.io';
const proxyPort = process.env.PG_PROXYPORT;
const proxyUsername = process.env.PG_PROXYUSERNAME;
const proxyPassword = process.env.PG_PROXYPASSWORD;
const proxyUrl = `http://${proxyHost}:${proxyPort}`;

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    slowMo: 50,
    args: [
      `--proxy-server=${proxyUrl}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
      '--disable-software-rasterizer',
      '--disable-web-security'
    ],
    defaultViewport: {
      width: 1280,
      height: 800,
    },
  });

  const page = await browser.newPage();

  await page.authenticate({
    username: proxyUsername,
    password: proxyPassword,
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  try {
    await page.goto('https://www.akakce.com/j/gl/?t=pr&i=100080686&s=0&b=315', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const html = await page.content();
    console.log('✅ Sayfa HTML alındı:\n', html);
  } catch (err) {
    console.error('❌ Sayfa yüklenemedi:', err.message);
  } finally {
    await browser.close();
  }
};

launchBrowser();
