import { exec } from 'child_process';
import pkg from 'pg';
import pLimit from 'p-limit'; // Paralel görev sınırı için

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js'; // For Supabase data insertion (optional)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bir üst dizindeki .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pkg;

const password = process.env.PG_PASSWORD;
const encodedPassword = encodeURIComponent(password);

const base = process.env.PG_CONNECTION_STRING_BASE;

const connectionString = base.replace('@', `${encodedPassword}@`);

const limit = pLimit(5); // Maksimum paralel görev sayısını 20 olarak ayarla

async function fetchLinksUntilEmpty() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to the database.');

    await updateProcessStatus(false);

    while (true) {
      const res = await client.query(`
                WITH max_sirala AS (
                SELECT MAX(d.siralama) AS max_sirala
                FROM dinamik_akakce_kategoriler_linkler_tumu d
                LEFT JOIN dina_f_akakce_links_new l 
                    ON d.kategori_ana = l.ana_kat
                    AND d.kategori_alt = l.alt_kat1
                    AND d.kategori_alt2 = l.alt_kat2
                    AND l.timestamp = (
                        SELECT hizli_timestamp
                        FROM update_dinamik
                        WHERE id = 'Pazarama'
                    )
                WHERE 
                    d.ctcode IS NOT NULL 
                    AND d.link != 'https://www.akakce.com/wireless-dongle.html' 
                    AND d.link != 'https://www.akakce.com/hava-perdesi.html'
                    AND (l.ana_kat IS NULL OR d.kategori_ana != l.ana_kat)
                    AND (l.alt_kat1 IS NULL OR d.kategori_alt != l.alt_kat1)
                    AND (l.alt_kat2 IS NULL OR d.kategori_alt2 != l.alt_kat2)
                    AND (l.ana_kat IS NULL)
            ),
            parca_araliklari AS (
                SELECT
                    max_sirala.max_sirala,
                    CEIL(max_sirala.max_sirala / 5.0) AS parca_boyutu 
                FROM max_sirala
            ),
            parca_no AS (
                SELECT 
                    1 AS parca_no,  -- Örneğin 2. parça
                    (SELECT parca_boyutu FROM parca_araliklari) AS parca_boyutu,
                    (2 - 1) * (SELECT parca_boyutu FROM parca_araliklari) AS offset_value  
            )
            SELECT DISTINCT
                d.link, 
                d.kategori_ana,
                d.kategori_alt,
                d.kategori_alt2,
                d.siralama,
                d.ctcode
            FROM 
                dinamik_akakce_kategoriler_linkler_tumu d
            LEFT JOIN 
                dina_f_akakce_links_new l 
                ON d.kategori_ana = l.ana_kat
                AND d.kategori_alt = l.alt_kat1 
                AND d.kategori_alt2 = l.alt_kat2
                AND l.timestamp = (
                    SELECT hizli_timestamp
                    FROM update_dinamik
                    WHERE id = 'Pazarama'
                )
            JOIN parca_no pn ON TRUE
            WHERE 
                d.ctcode IS NOT NULL
                AND d.link != 'https://www.akakce.com/wireless-dongle.html' 
                AND d.link != 'https://www.akakce.com/hava-perdesi.html'
                AND (l.ana_kat IS NULL OR d.kategori_ana != l.ana_kat)
                AND (l.alt_kat1 IS NULL OR d.kategori_alt != l.alt_kat1)
                AND (l.alt_kat2 IS NULL OR d.kategori_alt2 != l.alt_kat2)
                AND (l.ana_kat IS NULL)
            ORDER BY d.siralama ASC
            LIMIT (SELECT parca_boyutu FROM parca_no)  
            OFFSET (SELECT offset_value FROM parca_no);  
      `);

      if (res.rows.length === 0) {
        console.log('No more data to fetch. Process completed.');
        await updateProcessStatus(true);
        break;
      }

      console.log(`Fetched ${res.rows.length} rows. Running concurrent tasks...`);

      // Her satır için paralel işlem başlat
      const tasks = res.rows.map(row =>
        limit(() =>
          runAkakceAnaKalanlar(row.link, row.kategori_ana, row.kategori_alt, row.kategori_alt2, row.ctcode)
        )
      );

      try {
        await Promise.all(tasks); // Tüm görevler tamamlanana kadar bekle
      } catch (err) {
        console.error('Error running concurrent tasks:', err);
        await updateProcessStatus(true);
        break;
      }
    }
  } catch (err) {
    console.error('Error fetching links:', err);
    await updateProcessStatus(true);
    throw err;
  } finally {
    await client.end();
    console.log('Disconnected from the database.');
  }
}

async function runAkakceAnaKalanlar(link, kategoriAna, kategoriAlt, kategoriAlt2, ctcode) {
  console.log(`Processing link: ${link}`);
  console.log(`Kategori Ana: ${kategoriAna}, Kategori Alt: ${kategoriAlt}, Kategori Alt 2: ${kategoriAlt2}, ctcode: ${ctcode}`);

  // Format the arguments by adding quotes
  const formattedLink = `"${link}"`;
  const formattedKategoriAna = `"${kategoriAna}"`;
  const formattedKategoriAlt = `"${kategoriAlt}"`;
  const formattedKategoriAlt2 = `"${kategoriAlt2}"`;
  const formattedctcode = `"${ctcode}"`;

  return new Promise((resolve, reject) => {
     const command = `node scrape_api_tum_urunler.mjs ${formattedLink} ${formattedKategoriAna} ${formattedKategoriAlt} ${formattedKategoriAlt2} ${formattedctcode}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing akakce_ana_kalanlar.mjs for link ${link}: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`Stderr for link ${link}: ${stderr}`);
      }
      console.log(`Stdout for link ${link}: ${stdout}`);
      resolve(stdout);
    });
  });
}

async function updateProcessStatus(status) {
  console.log(`Updating process status to: ${status}`);
  // Burada veritabanında durum güncelleme işlemi yapılabilir
}

fetchLinksUntilEmpty().catch(err => {
  console.error('Fatal error:', err);
});