import { spawn } from 'child_process';
import path from 'path';
const { Pool } = pkg;

import { exec } from 'child_process';
import pkg from 'pg';
import pLimit from 'p-limit'; // Paralel görev sınırı için

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

const supabaseUrl = process.env.PG_SUPABASEURL;
const supabaseKey = process.env.PG_SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const scrpant= process.env.PG_SCRPEANT; 

// Fetch links from the database
const limit = pLimit(1); // Maksimum paralel görev sayısını 20 olarak ayarla

async function fetchLinksUntilEmpty() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to the database.');

    await updateProcessStatus(false);

    while (true) {
      const res = await client.query(`
      SELECT link, kategori_ana,ctcode
      FROM dina_f_akakce_ana_best_sales_eksik_Scraplar_view
      WHERE siralama > 0
      AND siralama <= 10000 and checker = True
      limit 1;
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
          runAkakceAnaKalanlar(row.link, row.kategori_ana,row.ctcode)
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

async function runAkakceAnaKalanlar(link, kategoriAna,ctcode) {
  console.log(`Processing link: ${link}`);
  console.log(`Kategori Ana: ${kategoriAna}`);
  console.log(`ctcode: ${ctcode}`);

  // Format the arguments by adding quotes
  const formattedLink = `"${link}"`;
  const formattedKategoriAna = `"${kategoriAna}"`;
  const formattedctcode = `"${ctcode}"`;
  

  return new Promise((resolve, reject) => {
     const command = `node aka_best_sales.mjs ${formattedLink} ${formattedKategoriAna} ${formattedctcode}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing aka_best_sales.mjs for link ${link}: ${error.message}`);
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