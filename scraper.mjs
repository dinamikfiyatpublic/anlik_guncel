import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function scrapeData() {
  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set realistic browser-like headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Configure page navigation
    await page.setDefaultNavigationTimeout(60000); // 60 seconds timeout
    
    // Enable request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const response = await page.goto('https://www.akakce.com/j/gl/?t=pr&i=321437397&s=0&b=315', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    if (!response.ok()) {
      throw new Error(`Page failed to load with status: ${response.status()}`);
    }

    // Wait for selector with timeout handling
    try {
      await page.waitForSelector('body > ul > li', {
        timeout: 45000,
        visible: true
      });
    } catch (err) {
      console.error('Selector not found. Page content:');
      console.error(await page.content());
      throw err;
    }

    const products = await page.$$eval('body > ul > li', (items) => {
      return items.map((item) => {
        const fiyat = item.querySelector('div > span.pb_v8 > span')?.textContent?.trim() || 'Fiyat yok';
        const kargo = item.querySelector('div > span.pb_v8 > em')?.textContent?.trim() || 'Kargo yok';
        const satici = item.querySelector('div > span.v_v8')?.textContent?.trim() || 'Satıcı yok';
        return { fiyat, kargo, satici };
      });
    });

    console.log(JSON.stringify(products, null, 2));
    return products;
  } finally {
    await browser.close();
  }
}

scrapeData().catch(console.error);