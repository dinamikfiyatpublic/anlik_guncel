import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bir üst dizindeki .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });

puppeteer.use(StealthPlugin());

const supabaseUrl = process.env.PG_SUPABASEURL;
const supabaseKey = process.env.PG_SUPABASEKEY;
const viewName = process.env.PG_VIEW_NAME;
const supabase = createClient(supabaseUrl, supabaseKey);

if (!process.send) {
  console.error('HATA: Bu dosya doğrudan çalıştırılamaz. Ana süreç ile fork edilmelidir.');
  process.exit(1);
}

const args = process.argv.slice(2);
const [link, kategoriAna, kategoriAlt, kategoriAlt2, marka, urun_kodu, timestamp, sira, p_adi] = args;

console.log(`Alt Süreç (${urun_kodu}): Argümanlar alındı:\n`, {
  link, kategoriAna, kategoriAlt, kategoriAlt2, marka, urun_kodu, timestamp, sira, p_adi
});

const additionalData = {
  link,
  ana_kat: kategoriAna,
  alt_kat1: kategoriAlt,
  alt_kat2: kategoriAlt2,
  marka,
  urun_kodu,
  timestamp,
  sira,
  p_adi,
};

const scrapeAkakce = async (urun_kodu, additionalData) => {
  const url = `https://www.akakce.com/j/gl/?t=pr&i=${urun_kodu}&s=0&b=315`;

  const proxyHost = 'proxy.toolip.io';
  const proxyPort = process.env.PG_PROXYPORT;
  const proxyUsername = process.env.PG_PROXYUSERNAME;
  const proxyPassword = process.env.PG_PROXYPASSWORD;
  const proxyUrl = `${proxyHost}:${proxyPort}`;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=http://${proxyUrl}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      }
    });

    const page = await browser.newPage();

    // 🛡️ Ekstra sahtecilik burada
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      window.navigator.chrome = {
        runtime: {},
      };

      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr'] });
      Object.defineProperty(navigator, 'language', { get: () => 'tr-TR' });

      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter(parameter);
      };

      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const context = this.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, this.width, this.height);
        return toDataURL.apply(this, args);
      };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      navigator.mediaDevices = {
        enumerateDevices: async () => [],
      };
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.authenticate({
      username: proxyUsername,
      password: proxyPassword
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    } catch (error) {
      console.error(`Alt Süreç (${urun_kodu}): Sayfa yüklenemedi:`, error.message);
      process.send({
        status: 'error',
        urun_kodu,
        message: `Sayfa yüklenemedi: ${error.message}`,
      });
      return null;
    }

    await page.waitForSelector('body > ul > li', { timeout: 30000 });

    const products = await page.$$eval(
      'body > ul > li',
      (items, additionalData) => {
        const filtered = items.filter(item => item.querySelector('span.pb_v8 > span'));

        return filtered.map((item, idx) => {
          const fiyatRaw = item.querySelector('span.pb_v8 > span')?.innerText.trim();
          const formattedFiyat = fiyatRaw ? parseFloat(fiyatRaw.match(/[\d,.]+/)[0].replace(',', '.')) : null;
          if (!formattedFiyat) return null;

          const kargo = item.querySelector('span.pb_v8 > em')?.innerText.trim() || null;
          const saticiRaw = item.querySelector('div > span.v_v8')?.innerText.trim() || null;

          return {
            link: additionalData.link,
            p_fiyat: formattedFiyat,
            kargo,
            satici: saticiRaw,
            timestamp: additionalData.timestamp,
            marka: additionalData.marka || null,
            ana_kat: additionalData.ana_kat,
            alt_kat1: additionalData.alt_kat1,
            alt_kat2: additionalData.alt_kat2,
            urun_kodu: additionalData.urun_kodu,
            sira: parseInt(additionalData.sira, 10),
            p_adi: additionalData.p_adi,
            en_ucuz: idx + 1,
          };
        }).filter(item => item !== null);
      },
      additionalData
    );

    return products;
  } catch (err) {
    console.error(`Alt Süreç (${urun_kodu}): Kazıma hatası: ${err.message}`);
    process.send({ status: 'error', urun_kodu, message: `Kazıma hatası: ${err.message}` });
    return null;
  } finally {
    if (browser) await browser.close();
  }
};

const run = async () => {
  const scrapedProducts = await scrapeAkakce(urun_kodu, additionalData);

  if (scrapedProducts === null) {
    console.warn(`Alt Süreç (${urun_kodu}): Sayfa yüklenemediği için checker false yapılmadı.`);
    return;
  }

  if (!scrapedProducts.length) {
    console.warn(`Alt Süreç (${urun_kodu}): Kazınacak ürün bulunamadı.`);

    const { error: updateError } = await supabase
      .from(`${viewName}`)
      .update({ checker: false })
      .eq('urun_kodu', String(urun_kodu));

    if (updateError) {
      console.error(`Alt Süreç (${urun_kodu}): Supabase checker güncelleme hatası:`, updateError);
      process.send({
        status: 'error',
        urun_kodu,
        message: `Checker güncellenemedi: ${updateError.message}`
      });
      return;
    }

    process.send({
      status: 'completed',
      urun_kodu,
      message: 'Kazınacak ürün bulunamadı, checker false yapıldı.'
    });
    return;
  }

  for (const urun of scrapedProducts) {
    let platform = null;
    let satici = null;

    if (urun.satici) {
      const parts = urun.satici.split('/');
      if (parts.length === 2) {
        platform = parts[0].replace('.com', '').trim();
        satici = parts[1].replace('.com', '').trim();
      } else {
        platform = parts[0].replace('.com', '').trim();
      }
    }

    const kayit = {
      link: urun.link,
      ana_kat: urun.ana_kat,
      alt_kat1: urun.alt_kat1,
      alt_kat2: urun.alt_kat2,
      marka: urun.marka,
      urun_kodu: urun.urun_kodu,
      platform: platform,
      p_fiyat: urun.p_fiyat,
      kargo: urun.kargo,
      satici: satici,
      timestamp: urun.timestamp,
      en_ucuz: urun.en_ucuz,
      sira: urun.sira,
      p_adi: urun.p_adi,
    };

    console.log(`Alt Süreç (${urun_kodu}): Supabase'e yazılıyor:\n`, kayit);

    const { error: insertError } = await supabase
      .from('dina_f_akakce_details')
      .insert([kayit]);

    if (insertError) {
      console.error(`Alt Süreç (${urun_kodu}): Supabase insert hatası:`, insertError);
      process.send({
        status: 'error',
        urun_kodu,
        message: `Veritabanı ekleme hatası: ${JSON.stringify(insertError)}`
      });
      return;
    }
  }

  // ✅ CHECKER TRUE YAP
  const { error: updateCheckerError } = await supabase
    .from(`${viewName}`)
    .update({ checker: false })
    .eq('urun_kodu', String(urun_kodu));

  if (updateCheckerError) {
    console.error(`Alt Süreç (${urun_kodu}): Checker false güncellenemedi:`, updateCheckerError);
    process.send({
      status: 'error',
      urun_kodu,
      message: `Checker false güncellenemedi: ${updateCheckerError.message}`
    });
    return;
  }

  console.log(`Alt Süreç (${urun_kodu}): Checker false güncellendi.`);

  process.send({
    status: 'completed',
    urun_kodu,
    message: `Tüm ürünler başarıyla işlendi ve checker false yapıldı.`
  });
};

run().catch((err) => {
  console.error(`Alt Süreç (${urun_kodu}): Kritik hata:`, err);
  process.send({
    status: 'error',
    urun_kodu,
    message: `Kritik hata: ${err.message}`
  });
});
