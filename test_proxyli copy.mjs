import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

puppeteer.use(StealthPlugin());

const supabaseUrl = '';
const supabaseKey = ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function getTimestamp() {
  const { data, error } = await supabase
      .from('update_dinamik')
      .select('hizli_timestamp')
      .eq('id', 'Pazarama')
      .limit(1);

  if (error) {
    console.error('Supabase Timestamp Error:', error);
    return null;
  }

  return data.length > 0 ? data[0].hizli_timestamp : null;
}

async function insertDataToSupabase(data) {
  const { error } = await supabase
    .from('dina_f_akakce_platform_urunlerim_rakipli_yok')
    .insert(data);

  if (error) {
    console.error('Supabase Insert Error:', error);
    return false;
  }
  console.log('Veri Supabase\'e başarıyla eklendi');
  return true;
}

async function updateCheckerForMissingProducts(urunKodlari) {
  const { error } = await supabase
    .from('dina_f_akakce_platform_urunlerim_yok')
    .update({ checker: false })
    .in('urun_kodu', urunKodlari);

  if (error) {
    console.error('Supabase Update Error:', error);
  } else {
    console.log('Verisi olmayan ürünler için checker false olarak güncellendi');
  }
}

async function scrapeDataUsingPuppeteer(urunKodlari, timestamp) {
  const url = `https://api6.akakce.com/quickview/getall?prCodes=${urunKodlari}`;
  const payload = { url: url, country: "tr" };

  try {
    const response = await axios.post(
      'https://unlocker-api.lunaproxy.com/request',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer xxxxxxxxxx'
        }
      }
    );

    const htmlContent = response.data;
    console.log("API Response:", htmlContent);

    const match = htmlContent.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
    if (!match) {
      console.error("Hata: API yanıtında <pre> tag'ı bulunamadı!");
      return [];
    }

    const jsonString = match[1];
    const responseData = JSON.parse(jsonString);

    if (responseData?.result?.products) {
      const extractedData = responseData.result.products.flatMap(product => {
        return product.qvPrices.map(priceInfo => ({
          p_fiyat: priceInfo.price,
          kargo: priceInfo.shipPrice,
          en_ucuz: priceInfo.badge,
          satici: priceInfo.vdName,
          platform: priceInfo.vdName,
          urun_kodu: product.prCode,
          timestamp: timestamp
        }));
      });

      console.log('Extracted Data:', extractedData);
      await insertDataToSupabase(extractedData);

      return extractedData;
    } else {
      console.error('Hata: API yanıtı beklenen yapıda değil');
      return [];
    }
  } catch (error) {
    console.error('Hata:', error);
    throw error;
  }
}

async function processData(urunKodlariArray) {
  if (!urunKodlariArray || urunKodlariArray.length === 0) {
    console.error('Ürün kodu listesi boş!');
    return;
  }

  const timestamp = await getTimestamp();
  if (!timestamp) {
    console.error('Timestamp alınamadı!');
    return;
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const urunKodlari = urunKodlariArray.join(',');

  try {
    const scrapedData = await scrapeDataUsingPuppeteer(urunKodlari, timestamp);
    const foundProducts = scrapedData.map(item => item.urun_kodu);
    const notFoundProducts = urunKodlariArray.filter(urunKodu => !foundProducts.includes(urunKodu));

    if (notFoundProducts.length > 0) {
      await updateCheckerForMissingProducts(notFoundProducts);
    }

    console.log(`Processed batch:`, scrapedData);
  } catch (error) {
    console.error('Error scraping API:', error);
  }

  await browser.close();
  console.log('Tarayıcı kapatıldı, işlem tamamlandı.');
}

// Komut satırından gelen verileri al
const args = process.argv.slice(2);
const urunKodlariArray = args[0]?.split(',') || [];

await processData(urunKodlariArray); 