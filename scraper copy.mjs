import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function scrapeData() {
  const browser = await puppeteer.launch({
    headless: true, // Tarayıcıyı başlatırken arayüzsüz (headless) olarak başlatır
    args: ['--no-sandbox', '--disable-setuid-sandbox']  // Güvenlik nedeniyle argümanlar
  });

  const page = await browser.newPage();
  await page.goto('https://www.akakce.com/j/gl/?t=pr&i=321437397&s=0&b=315');
  await page.waitForSelector('body > ul > li');

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
