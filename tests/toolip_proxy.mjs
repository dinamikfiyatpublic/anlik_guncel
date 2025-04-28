import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Stealth plugin kullanımı
puppeteer.use(StealthPlugin());
const launchBrowser = async () => {
  const proxyHost = 'proxy.toolip.io';
  const proxyPort = process.env.PG_PROXYPORT;
  const proxyUsername = process.env.PG_PROXYUSERNAME;
  const proxyPassword = process.env.PG_PROXYPASSWORD;
  const proxyUrl = `${proxyHost}:${proxyPort}`;

  const browser = await puppeteer.launch({
      headless: true,
      args: [
          `--proxy-server=http://${proxyUrl}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors'
      ],
      defaultViewport: {
          width: 1920,
          height: 1080,
      }
  });

  const page = await browser.newPage();

  // Proxy kimlik doğrulama
  try {
    await page.authenticate({
        username: proxyUsername,
        password: proxyPassword,
    });
} catch (err) {
    console.error('❌ Proxy kimlik doğrulaması başarısız:', err.message);
}

  // Ek HEADLESS detection önleme
  await page.evaluateOnNewDocument(() => {
      // WebDriver sahteciliği
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Chrome ile uyumlu göstermek
      window.navigator.chrome = {
          runtime: {},
          // diğer gerekli özellikleri ekleyebilirsin
      };

      // Dil ayarları
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr'] });
      Object.defineProperty(navigator, 'language', { get: () => 'tr-TR' });

      // Platform sahteciliği
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

      // Hardware Concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

      // Memory
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

      // WebGL Vendor / Renderer sahteciliği
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
          if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
          return getParameter(parameter);
      };

      // Canvas fingerprint sahteciliği
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
          const context = this.getContext('2d');
          context.fillStyle = 'white';
          context.fillRect(0, 0, this.width, this.height);
          return toDataURL.apply(this, args);
      };

      // Permissions API sahteciliği
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
              ? Promise.resolve({ state: Notification.permission })
              : originalQuery(parameters);

      // Plugins sahteciliği
      Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
      });

      // MediaDevices sahteciliği
      navigator.mediaDevices = {
          enumerateDevices: async () => [],
      };
  });

  // Güçlü bir User-Agent tanımla
  await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  try {
      await page.goto('https://www.akakce.com/j/gl/?t=pr&i=100080686&s=0&b=315', { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('body', { timeout: 60000 });

      const html = await page.content();
      console.log('✅ Sayfa HTML İçeriği:\n', html);
  } catch (err) {
      console.error('❌ Sayfa yüklenemedi:', err.message);
  } finally {
      await browser.close();
  }
};

// Launch
launchBrowser();