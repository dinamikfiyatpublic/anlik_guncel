import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Using Stealth Plugin to prevent detection
puppeteer.use(StealthPlugin());

async function scrapeData() {
  let browser;
  try {
    // Launch the browser in headless mode for background scraping
    browser = await puppeteer.launch({
      headless: true, // Set to true for headless scraping (no UI)
      args: [
        '--no-sandbox', // Avoid sandbox issues in environments like CI
        '--disable-setuid-sandbox', // Disable the setuid sandbox
        '--disable-gpu', // Disables GPU hardware acceleration (useful in CI environments)
        '--remote-debugging-port=9222', // Optional: Enables remote debugging
        '--disable-software-rasterizer', // Disable software rasterizer
        '--no-first-run', // Prevent Chrome from launching the first-time setup
        '--disable-dev-shm-usage', // Prevents issues related to shared memory in Docker
        '--headless' // Ensure headless mode
      ],
      defaultViewport: null, // Allowing flexible viewport sizes
    });

    const page = await browser.newPage();

    // Browser fingerprinting evasion: Modify navigator.plugins
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [{
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          description: 'Portable Document Format'
        }],
      });
    });

    // Navigate to the page
    await page.goto('https://www.akakce.com/j/gl/?t=pr&i=321437397&s=0&b=315', { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the page to load the relevant elements
    await page.waitForSelector('body > ul > li', { timeout: 60000 });

    // Take a screenshot of the page
    await page.screenshot({ path: 'page_screenshot.png', fullPage: true });
    console.log('Screenshot taken and saved as page_screenshot.png');

    // Simulate random mouse movements to avoid bot detection
    await page.mouse.move(
      Math.floor(Math.random() * 500),
      Math.floor(Math.random() * 500),
      { steps: 10 }
    );

    // Simulate scrolling to make sure all content is loaded
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

    // Extract product data from the page
    const products = await page.$$eval('body > ul > li', (items) => {
      return items.map((item) => {
        const fiyat = item.querySelector('div > span.pb_v8 > span')?.innerText.trim() || 'Fiyat yok';
        const kargo = item.querySelector('div > span.pb_v8 > em')?.innerText.trim() || 'Kargo yok';
        const satici = item.querySelector('div > span.v_v8')?.innerText.trim() || 'Satıcı yok';
        return { fiyat, kargo, satici };
      });
    });

    // Log and return the scraped data
    console.log(JSON.stringify(products));
    return products;
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Ensure that the browser is closed properly
    if (browser) {
      await browser.close();
    }
  }
}

scrapeData().catch(console.error);
