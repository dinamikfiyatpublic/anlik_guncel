import { spawn } from 'child_process';
import pkg from 'pg';
import * as fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Modülün bulunduğu dosya yolunu ve dizin bilgisini al
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bir üst dizindeki .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pkg;

const rawPassword = process.env.PG_PASSWORD;
const encodedPassword = encodeURIComponent(rawPassword);
const base = process.env.PG_CONNECTION_STRING_BASE;

const connectionString = base.replace('@', `${encodedPassword}@`);

const viewName = process.env.PG_VIEW_NAME;

let childProcesses = [];
let completedProcesses = 0; // Tamamlanan süreç sayısı

function logTimeToFile(message) {
    const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const logMessage = `[${now}] ${message}\n`;
    fs.appendFileSync('log.txt', logMessage);
}

// Her bir parça için veriyi kontrol et
async function isViewStillHasData(parcaIndex) {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
        SELECT COUNT(*) as count
        FROM ${viewName}
        WHERE checker = true
        AND sirala >= ${(parcaIndex - 1) * 100} AND sirala <= ${parcaIndex * 100};  -- Parça aralığına göre sorgu
    `);

    await client.end();
    return parseInt(res.rows[0].count) > 0;
}

function startProcess(parcaIndex) {
    console.log(`Denetleyici: Parça ${parcaIndex} başlatılıyor...`);
    logTimeToFile(`Parça ${parcaIndex} BAŞLADI`);

    const child = spawn('node', [`./scrape_api_urunlerim_rakipler_kalan${parcaIndex}.mjs`], {
        stdio: 'inherit'
    });

    child.on('exit', async (code) => {
        console.log(`Denetleyici: Parça ${parcaIndex} ${code} koduyla sonlandı.`);
        logTimeToFile(`Parça ${parcaIndex} TAMAMLANDI (Çıkış kodu: ${code})`);

        completedProcesses++;

        const stillHasData = await isViewStillHasData(parcaIndex);
        if (stillHasData) {
            console.log(`Denetleyici: Parça ${parcaIndex} verisi hâlâ mevcut.`);
        } else {
            console.log(`Denetleyici: Parça ${parcaIndex} veri kalmadı.`);
        }

        // Tüm süreçler tamamlandığında ana süreci yeniden başlat
        if (completedProcesses === 5) {
            console.log('Denetleyici: Tüm parçalar tamamlandı, ana işlem yeniden başlatılacak...');
            startMainProcess();  // Ana işlemi yeniden başlat
        }
    });

    childProcesses.push(child);
}

// Ana süreci başlat
function startMainProcess() {
    console.log('Denetleyici: Ana işlem başlatılıyor...');
    logTimeToFile('Ana işlem BAŞLADI');

    // 5 farklı parça başlatılıyor
    for (let i = 1; i <= 5; i++) {
        startProcess(i);
    }
}

// İzlemeyi başlat
startMainProcess();
