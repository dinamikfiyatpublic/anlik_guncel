import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js'; // For Supabase data insertion (optional)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bir üst dizindeki .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });

puppeteer.use(StealthPlugin());

const password = process.env.PG_PASSWORD;
const encodedPassword = encodeURIComponent(password);
const base = process.env.PG_CONNECTION_STRING_BASE;
const connectionString = base.replace('@', `${encodedPassword}@`);

const supabaseUrl = process.env.PG_SUPABASEURL;
const supabaseKey = process.env.PG_SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const scrpant= process.env.PG_SCRPEANT; 

const [
    , , // İlk iki argüman genellikle `node` ve dosya adı olur, bunları atlıyoruz
    link,
    kategori_ana,
    //kategori_alt,
    //kategori_alt2,
    ctcode
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
        .from('dinamik_akakce_kategoriler_coksatan_detay')
        .insert(scrapedData);

    if (error) {
        console.error('Error inserting data to Supabase:', error);
    } else {
        console.log('Data successfully inserted into Supabase');
    }
}

async function updateCheckerFalse() {
    const { error } = await supabase
        .from('dinamik_akakce_kategoriler_coksatan')
        .update({ checker: false })
        .eq('link', link);

    if (error) {
        console.error('Error updating checker to false:', error);
    } else {
        console.log(`Checker set to false for link: ${link}`);
    }
}

async function scrapePage(page, timestamp) {
    const url = `https://api6.akakce.com/dl/dlquery/?PrSetId=85085&CtCode=${ctcode}&Sort=1&Page=1&`;

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        const pageContent = await page.evaluate(() => document.body.innerText);

        let jsonData;
        try {
            jsonData = JSON.parse(pageContent);
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            return null;
        }

        if (
            !jsonData ||
            !jsonData.result ||
            jsonData.result.countOfProducts === 0 ||
            !jsonData.result.productList ||
            !jsonData.result.productList.products
        ) {
            console.error('Invalid or empty product response:', jsonData);
            return null;
        }

        const scrapedData = jsonData.result.productList.products.map((item, index) => ({
            sira: index + 1,
            link: link,
            p_fiyat: item.price,
            marka: item.mkName,
            p_adi: item.name,
            timestamp: timestamp,
            ana_kat: kategori_ana,
            ctcode: ctcode,
            urun_kodu: item.code
        }));

        console.log(`Scraped data from ${url}:`, scrapedData);
        await saveToSupabase(scrapedData);
        return scrapedData;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return null;
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const timestamp = await getTimestamp();
    if (timestamp) {
        const result = await scrapePage(page, timestamp);

        if (!result) {
            await updateCheckerFalse();
        }
    }

    await browser.close();
})();