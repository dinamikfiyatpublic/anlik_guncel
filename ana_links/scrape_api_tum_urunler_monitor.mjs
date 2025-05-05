import { spawn } from 'child_process';
import pkg from 'pg';
import * as fs from 'fs';


const { Client } = pkg;

const password = process.env.PG_PASSWORD;
const encodedPassword = encodeURIComponent(password);

const base = process.env.PG_CONNECTION_STRING_BASE;

const connectionString = base.replace('@', `${encodedPassword}@`);

const viewName = process.env.PG_VIEW_NAME;


let child = null;

function logTimeToFile(message) {
    const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const logMessage = `[${now}] ${message}\n`;
    fs.appendFileSync('log.txt', logMessage);
}

async function isViewStillHasData() {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
        SELECT COUNT(*) as count
        FROM dinamik_akakce_kategoriler_ana_linkler_kalan_yeni;
    `);

    await client.end();
    return parseInt(res.rows[0].count) > 0;
}

function startMainProcess() {
    console.log('Denetleyici: Ana işlem başlatılıyor...');
    logTimeToFile('Ana işlem BAŞLADI');

    child = spawn('node', ['./scrape_api_tum_concurrent_ana1.mjs'], {
        stdio: 'inherit'
    });

    child.on('exit', async (code) => {
        console.log(`Denetleyici: Ana işlem ${code} koduyla sonlandı.`);
        logTimeToFile(`Ana işlem TAMAMLANDI (Çıkış kodu: ${code})`);

        const stillHasData = await isViewStillHasData();
        if (stillHasData) {
            console.log('Denetleyici: View’de hâlâ veri var. Ana işlem tekrar başlatılacak...');
            setTimeout(() => startMainProcess(), 3000); // 3 saniye sonra tekrar dene
        } else {
            console.log('Denetleyici: Veri kalmamış. İzleme durduruluyor.');
            logTimeToFile('Veri kalmadı, izleme durdu.');
        }
    });
}

// İzlemeyi başlat
startMainProcess();