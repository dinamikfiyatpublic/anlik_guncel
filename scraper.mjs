import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function scrapeProductPage() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=tr-TR',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  
  try {
    // Türk kullanıcı ayarları
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.akakce.com/'
    });

    // Sayfaya direkt erişim
    await page.goto('https://www.akakce.com/j/gl/?t=pr&i=321437397&s=0&b=315', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Pop-up kontrolü
    try {
      await page.click('button[aria-label="Kapat"]', { timeout: 3000 });
      console.log('Pop-up kapatıldı');
    } catch {}

    // Ürün bilgileri için CSS seçicileri
    const productData = await page.evaluate(() => {
      const extractText = (selector) => 
        document.querySelector(selector)?.textContent?.trim() || 'Bilgi yok';

      return {
        ürün_adi: extractText('h1.pd_header'),
        fiyat: extractText('div.pd_price'),
        kargo: extractText('div.pd_shipping'),
        satıcı: extractText('a.pd_merchant'),
        değerlendirme: extractText('div.pd_rating'),
        stok_durumu: document.querySelector('div.pd_stock') 
          ? 'Stokta Var' 
          : 'Stok Yok'
      };
    });

    // Teklifleri çekme
    const offers = await page.$$eval('div.pd_offers > div.offer', (offers) => 
      offers.map(offer => ({
        satici: offer.querySelector('.offer_merchant')?.textContent?.trim(),
        fiyat: offer.querySelector('.offer_price')?.textContent?.trim(),
        kargo: offer.querySelector('.offer_shipping')?.textContent?.trim() || 'Ücretsiz Kargo'
      })
    ));

    console.log('Ürün Bilgileri:', productData);
    console.log('Teklifler:', offers);
    
    return { productData, offers };

  } catch (error) {
    await page.screenshot({ path: 'error.png' });
    console.error('Hata:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Çalıştırma
scrapeProductPage();