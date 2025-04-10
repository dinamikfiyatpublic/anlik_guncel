import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const lunaproxyApiKey = '';

async function scrapeAkakce(urunKodu) {
  const baseUrl = `https://www.akakce.com/j/gl/?t=pr&i=${urunKodu}&s=0&b=315`;

  try {
    const response = await axios.post(
      'https://unlocker-api.lunaproxy.com/request',
      { url: baseUrl },
      {
        headers: {
          Authorization: `Bearer ${lunaproxyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const html = response.data;
    const $ = cheerio.load(html);

    const products = [];

    $('body > ul > li').each((_, item) => {
      const fiyatStr = $(item).find('div > span.pb_v8 > span').text().trim();
      const kargo = $(item).find('div > span.pb_v8 > em').text().trim();
      const saticiFull = $(item).find('div > span.v_v8').text().trim(); // Pazarama/KAFKASDA gibi
      const imgUrl = $(item).find('img[data-src]').attr('data-src');

      const fiyat = parseFloat(fiyatStr.replace(' TL', '').replace('.', '').replace(',', '.'));

      // Satıcı bilgilerini ayır: "Pazarama/KAFKASDA" → ["Pazarama", "KAFKASDA"]
      let platform = 'Bilinmiyor';
      let satici = 'Bilinmiyor';
      if (saticiFull.includes('/')) {
        [platform, satici] = saticiFull.split('/');
      } else {
        satici = saticiFull;
      }

      products.push({
        urun_kodu: urunKodu,
        fiyat,
        kargo,
        platform,
        satici,
        imgUrl, // İstersen bunu da ekleyebilirsin
      });
    });

    console.log('📦 Products:', JSON.stringify(products, null, 2));
    fs.writeFileSync('products.json', JSON.stringify(products, null, 2));
  } catch (err) {
    console.error('❌ Scraping error:', err.message);
  }
}

const args = process.argv.slice(2);
const urunKodu = args[0];

if (!urunKodu) {
  console.error('Lütfen bir ürün kodu girin!');
  process.exit(1);
}

await scrapeAkakce(urunKodu);
