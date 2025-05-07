import { spawn } from 'child_process';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

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
const pool = new Pool({
  connectionString: `postgresql://postgres.vuoxqclhziyumhrhbsqo:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
});

// Fetch links from the database using the pool
const fetchLinks = async () => {
  const client = await pool.connect(); // Get a client from the pool

  try {
    // Fetch data from the view
    const query = `
      SELECT link, kategori_ana
      FROM dina_f_akakce_ana_best_sales_eksik_Scraplar_view
      WHERE siralama > 0
      AND siralama <= 10000 and checker = True;
    `;
    
    const { rows } = await client.query(query); // Execute the query
    console.log('Data fetched successfully:', rows.length);

    return rows; // Return the rows if data is found
  } catch (error) {
    console.error("Error fetching links:", error);
    process.exit(1); // Exit with error code if something goes wrong
  } finally {
    client.release(); // Release the client back to the pool
  }
};

// Process each link independently by running the scraping script in separate processes
const processLink = (formattedItem) => {
  return new Promise((resolve, reject) => {
    const { link, kategori_ana } = formattedItem;

    const args = [
      'node',
      'aka_best_sales.mjs',
      link,
      `"${kategori_ana}"`
    ];

    console.log('Executing:', args.join(' '));

    const childProcess = spawn(args[0], args.slice(1), {
      shell: true,
      cwd: __dirname,
      env: { ...process.env } // Pass environment variables
    });

    let output = '';
    let error = '';

    childProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Command succeeded: ${output}`);
        resolve(output);
      } else {
        console.error(`Command failed with code ${code}: ${error}`);
        reject(new Error(`Process exited with code ${code}: ${error}`));
      }
    });

    childProcess.on('error', (err) => {
      console.error(`Process error: ${err.message}`);
      reject(err);
    });
  });
};

// Function to process links in batches
const processLinksInBatches = async (rows, batchSize = 10) => {
  try {
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize); // Get a chunk of links
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

      // Process the batch concurrently
      const promises = batch.map((row) => processLink(row)); // Pass the entire row to processLink
      const results = await Promise.all(promises); // Wait for all processes in this batch to finish

      // Log results for this batch
      results.forEach((result, index) => {
        console.log(`Processed link ${batch[index].link}:`, result);
      });

      console.log(`Batch ${Math.floor(i / batchSize) + 1} processed successfully.`);
    }

    console.log("Batch processing completed.");
  } catch (error) {
    console.error("Error processing links:", error);
  }
};

// Process all links by fetching the latest batch, processing it, and repeating if data exists
const processAllLinks = async () => {
  let rows = await fetchLinks(); // Initial fetch
  while (rows.length > 0) {
    await processLinksInBatches(rows, 10); // Process in batches of 10
    rows = await fetchLinks(); // Fetch new data after batch processing
    if (rows.length === 0) {
      console.log("No more data to process, finishing.");
      process.exit(0); // Stop further processing if no rows are found
    }
  }
};

// Initiate processing
processAllLinks();