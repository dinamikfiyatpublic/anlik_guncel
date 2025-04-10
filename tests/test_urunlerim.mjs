import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

puppeteer.use(StealthPlugin());

const supabaseUrl = '';
const supabaseKey = ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

const [
    , , // İlk iki argüman genellikle `node` ve dosya adı olur, bunları atlıyoruz
    link,
    ana_kat,
    alt_kat1,
    alt_kat2,
    alt_kat3,
    adet,
    ctcode,
    sirket
] = process.argv;

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

async function saveToSupabase(scrapedData) {
    if (!scrapedData || scrapedData.length === 0) {
        console.log('No data to insert.');
        return;
    }

    const { error } = await supabase
        .from('dina_f_akakce_platform_urunlerim_yok')
        .insert(scrapedData);
    
    if (error) {
        console.error('Error inserting data to Supabase:', error);
    } else {
        console.log('Data successfully inserted into Supabase');
    }
}

async function scrapePage(page, timestamp) {
    try {
        const url = `https://api6.akakce.com/store/vdquery?VdName=idefix&CtCode=${ctcode}&Sort=1&ForType=1&rf=false&rct=false&sm=false&03260952`;
        await page.goto(url, { waitUntil: 'networkidle2' });

        const scrapedData = await page.evaluate((timestamp, additionalData) => {
            const jsonData = JSON.parse(document.body.innerText);
            return jsonData.result.pgList.map((item, index) => {
                const urlParams = new URLSearchParams(item.url.split('?')[1]);
                const urunKodu = urlParams.get('p'); // "p" parametresini al

                return {
                    sira: index + 1,
                    link: additionalData.link,
                    p_fiyat: item.price,
                    kargo: item.shipPrice,
                    p_adi: item.pgName,
                    timestamp: timestamp,
                    adet: additionalData.adet,
                    ana_kat: additionalData.ana_kat,
                    alt_kat1: additionalData.alt_kat1,
                    alt_kat2: additionalData.alt_kat3,
                    satici: additionalData.sirket,
                    platform: additionalData.sirket,
                    ctcode: additionalData.ctcode,
                    urun_kodu: urunKodu
                };
            });
        }, timestamp, { link, adet, ana_kat, alt_kat1, alt_kat2, alt_kat3, sirket, ctcode });

        console.log(`Scraped data from ${url}:`, scrapedData);
        await saveToSupabase(scrapedData);
        return scrapedData;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return null;
    }
}

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const timestamp = await getTimestamp();
    if (timestamp) {
        await scrapePage(page, timestamp);
    }

    await browser.close();
})();