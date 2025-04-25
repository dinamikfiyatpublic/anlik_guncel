import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// .env'den okuma gerekiyorsa dotenv
import dotenv from 'dotenv';
dotenv.config();

// Stealth plugin aktif et
puppeteer.use(StealthPlugin());

const proxyHost = 'proxy.toolip.io';
const proxyPort = process.env.PG_PROXYPORT;
const proxyUsername = process.env.PG_PROXYUSERNAME;
const proxyPassword = process.env.PG_PROXYPASSWORD;
const proxyUrl = `${proxyHost}:${proxyPort}`;

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: false,  // HEADFUL çalıştır
    slowMo: 50,        // Daha insansı tıklama hızları
    args: [
      `--proxy-server=http=${proxyUrl}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--window-size=1280,800',
            '--disable-software-rasterizer',  // Yazılım rasterizörü engelle
            '--disable-web-security'
    ],
    defaultViewport: {
      width: 1280,
      height: 800,
    }
  });

  const page = await browser.newPage();

  await page.authenticate({
    username: proxyUsername,
    password: proxyPassword,
  });

  // VS Code tarayıcı fingerprint taklidi
  await page.evaluateOnNewDocument(() => {
    // Webdriver kapalı göster
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  
    // Dil ayarları Türkiye gibi göster
    Object.defineProperty(navigator, 'language', { get: () => 'tr-TR' });
    Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr'] });
  
    // Chrome gibi tanıt
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  
    // Platformu manipüle et
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  
    // Sistem özelliklerini düzenle
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    await page.goto('https://www.akakce.com/j/gl/?t=pr&i=100080686&s=0&b=315', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('body', { timeout: 60000 });

    const html = await page.content();
    console.log('✅ Sayfa HTML İçeriği Alındı:\n', html);
  } catch (err) {
    console.error('❌ Sayfa yüklenemedi:', err.message);
  } finally {
    await browser.close();
  }
};

// xvfb-run ile çalıştırma için terminalde şu komut kullanılır:
launchBrowser();
