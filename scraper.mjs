import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Stealth Plugin kullanımı
puppeteer.use(StealthPlugin());

async function scrapeData() {
  const browser = await puppeteer.launch({
    headless: false, // Tarayıcıyı başlatırken arayüzsüz (headless) olarak başlatır
    args: ['--no-sandbox', // Avoid sandbox issues in environments like CI
      '--disable-setuid-sandbox', // Disable the setuid sandbox
      '--disable-gpu', // Disables GPU hardware acceleration (useful in CI environments)
      '--remote-debugging-port=9222', // Optional: Enables remote debugging
      '--disable-software-rasterizer', // Disable software rasterizer
      '--no-first-run', // Prevent Chrome from launching the first-time setup
      '--disable-dev-shm-usage', // Prevents issues related to shared memory in Docker]  // Güvenlik nedeniyle argümanlar
    ] 
  });

  const page = await browser.newPage();

  // Tarayıcı izi karıştırma
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [{
        name: 'Chrome PDF Plugin',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format'
      }]
    });
  });

  await page.goto('https://www.akakce.com/j/gl/?t=pr&i=321437397&s=0&b=315', { waitUntil: 'domcontentloaded' });

  // Ensure screenshots directory exists in the repo
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotPath = path.join(screenshotDir, 'page_screenshot.png');
  
  try {
    // Wait for the selector with an increased timeout
    await page.waitForSelector('body > ul > li', { timeout: 60000 }); // 60 seconds timeout

    // Screenshot the page
    await page.screenshot({ path: screenshotPath });

    // Rastgele mouse hareketleri
    await page.mouse.move(
      Math.floor(Math.random() * 500),
      Math.floor(Math.random() * 500),
      { steps: 10 }
    );

    // Sayfa scroll simülasyonu
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Extract products
    const products = await page.$$eval('body > ul > li', (items) => {
      return items.map((item) => {
        const fiyat = item.querySelector('div > span.pb_v8 > span')?.innerText.trim() || 'Fiyat yok';
        const kargo = item.querySelector('div > span.pb_v8 > em')?.innerText.trim() || 'Kargo yok';
        const satici = item.querySelector('div > span.v_v8')?.innerText.trim() || 'Satıcı yok';
        return { fiyat, kargo, satici };
      });
    });

    console.log(JSON.stringify(products));
    return products;

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrapeData().catch(console.error);