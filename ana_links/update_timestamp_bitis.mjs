import pkg from 'pg'; // PostgreSQL client import
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js'; // For Supabase data insertion (optional)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bir üst dizindeki .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Database password
const password =  process.env.PG_PASSWORD;
const encodedPassword = encodeURIComponent(password);

const base = process.env.PG_CONNECTION_STRING_BASE;

const connectionString = base.replace('@', `${encodedPassword}@`);

// Import the Client class from pg package
const { Client } = pkg;

// Initialize PostgreSQL client
async function checkAndUpdate() {
    const client = new Client({
        connectionString: connectionString
    });

    try {
        await client.connect();
        console.log('✅ Connected to the database.');

        // Fetch current timestamps
        const fetchQuery = `
            SELECT hizli_timestamp, hizli_timestamp_final
            FROM update_dinamik
            WHERE id = 'Pazarama'
            LIMIT 1;
        `;
        const res = await client.query(fetchQuery);

        if (res.rows.length === 0) {
            console.log("⚠️ No records found for 'Pazarama'.");
            return { status: "No records found" };
        }

        const { hizli_timestamp, hizli_timestamp_final } = res.rows[0];
        console.log(`📌 Current timestamps:\n- hizli_timestamp: ${hizli_timestamp}\n- hizli_timestamp_final: ${hizli_timestamp_final}`);

        // Compare and update if different
        if (hizli_timestamp !== hizli_timestamp_final) {
            console.log("🛠️ Timestamps are different. Performing update...");

            const updateQuery = `
                UPDATE update_dinamik
                SET hizli_timestamp_final = hizli_timestamp
                WHERE hizli_timestamp != hizli_timestamp_final AND id = 'Pazarama';
            `;
            const updateRes = await client.query(updateQuery);

            if (updateRes.rowCount > 0) {
                console.log("✅ Update successful. Verifying...");

                // Retry verification up to 3 times with 2-second intervals
                for (let attempt = 1; attempt <= 3; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    console.log(`🔁 Verification attempt ${attempt}...`);

                    const verifyQuery = `
                        SELECT hizli_timestamp, hizli_timestamp_final
                        FROM update_dinamik
                        WHERE id = 'Pazarama'
                        LIMIT 1;
                    `;
                    const verifyRes = await client.query(verifyQuery);
                    const verifyRow = verifyRes.rows[0];

                    if (verifyRow.hizli_timestamp === verifyRow.hizli_timestamp_final) {
                        console.log(`✅ Update verified. New hizli_timestamp_final: ${verifyRow.hizli_timestamp_final}`);
                        return {
                            status: "Success",
                            updated: true,
                            newValue: verifyRow.hizli_timestamp_final
                        };
                    }
                }

                console.log("❌ Update verification failed after 3 attempts.");
                return { status: "Verification failed", updated: false };
            } else {
                console.log("⚠️ No rows were updated.");
                return { status: "Update failed", updated: false };
            }
        } else {
            console.log("✅ Timestamps are already equal. No update needed.");
            return { status: "No update needed", updated: false };
        }
    } catch (err) {
        console.error('❌ Error:', err);
        throw err;
    } finally {
        await client.end();
        console.log('🔌 Disconnected from the database.');
    }
}

// Run the function
checkAndUpdate()
    .then(result => console.log("📋 Final Result:", result))
    .catch(err => console.error("🚨 Script Error:", err));