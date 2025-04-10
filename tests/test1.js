const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Komut satırından `urunKodu` parametresini al
const urunKodu = process.argv[2];

if (!urunKodu) {
  console.log('❌ Lütfen bir ürün kodu belirtin!');
  process.exit(1);
}

puppeteer.use(StealthPlugin());

const getTRProxies = async () => {
  const res = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=TR&ssl=all&anonymity=all');
  return res.data.trim().split('\n').filter(Boolean);
};

const scrapeAkakce = async (urunKodu) => {
  const proxies = await getTRProxies();
  console.log(`🔍 ${proxies.length} TR proxy bulundu. Deneniyor...`);

  for (const proxy of proxies) {
    console.log(`🔌 Proxy deneniyor: ${proxy}`);
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          `--proxy-server=http://${proxy}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ]
      });

      const page = await browser.newPage();
      const url = `https://www.akakce.com/j/gl/?t=pr&i=${urunKodu}&s=0&b=315&`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const html = await page.content();
      await browser.close();

      const $ = cheerio.load(html);
      const products = [];

      $('body > ul > li').each((_, item) => {
        const fiyatStr = $(item).find('div > span.pb_v8 > span').text().trim();
        const kargo = $(item).find('div > span.pb_v8 > em').text().trim();
        const saticiFull = $(item).find('div > span.v_v8').text().trim();
        let imgUrl = $(item).find('img[data-src]').attr('data-src');

        // Fiyatı işleyip sayıya dönüştürme
        const fiyat = parseFloat(
          fiyatStr.replace(' TL', '').replace(/\./g, '').replace(',', '.')
        );

        // Eğer fiyat geçersizse (null, NaN) ürünü ekleme
        if (isNaN(fiyat) || fiyat === null) {
          return; // Bu ürünü atla
        }

        // `platform` ve `satici` için 'null' kullan
        let platform = null;
        let satici = null;
        if (saticiFull.includes('/')) {
          [platform, satici] = saticiFull.split('/');
        } else {
          satici = saticiFull;
        }

        // imgUrl'yi https: ile başlat
        if (imgUrl && !imgUrl.startsWith('https:')) {
          imgUrl = `https:${imgUrl}`;
        }

        products.push({
          urun_kodu: urunKodu,
          fiyat,
          kargo,
          platform, // null olarak atanmış
          satici, // null olarak atanmış
          imgUrl,
        });
      });

      console.log('📦 Products:', JSON.stringify(products, null, 2));
      fs.writeFileSync('products.json', JSON.stringify(products, null, 2));
      break; // İlk çalışan proxy ile iş bitti
    } catch (err) {
      console.log(`❌ Hatalı proxy: ${proxy} → ${err.message}`);
    }
  }
};

// `urunKodu` parametresini komut satırından al
scrapeAkakce(urunKodu);
