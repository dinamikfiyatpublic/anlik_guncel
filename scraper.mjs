import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Stealth Plugin kullanımı
puppeteer.use(StealthPlugin());

async function scrapeData() {
  const browser = await puppeteer.launch({
    headless: false, // Tarayıcıyı başlatırken arayüzsüz (headless) olarak başlatır
    args: ['--no-sandbox', '--disable-setuid-sandbox']  // Güvenlik nedeniyle argümanlar
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

  await page.goto('https://www.akakce.com/j/gl/?t=pr&i=321437397&s=0&b=315');
  await page.waitForSelector('body > ul > li');

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

  const products = await page.$$eval('body > ul > li', (items) => {
    return items.map((item) => {
      const fiyat = item.querySelector('div > span.pb_v8 > span')?.innerText.trim() || 'Fiyat yok';
      const kargo = item.querySelector('div > span.pb_v8 > em')?.innerText.trim() || 'Kargo yok';
      const satici = item.querySelector('div > span.v_v8')?.innerText.trim() || 'Satıcı yok';
      return { fiyat, kargo, satici };
    });
  });

  await browser.close();

  console.log(JSON.stringify(products));
  return products;
}

scrapeData().catch(console.error);
