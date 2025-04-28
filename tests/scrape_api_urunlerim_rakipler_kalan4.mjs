import { fork } from 'child_process';
import pkg from 'pg';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bir üst dizindeki .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { Client } = pkg;
const globalStartTime = Date.now();

// PID kontrolü
const pidFile = './akakce.pid';
if (fs.existsSync(pidFile)) {
    console.log('Ana Süreç: Zaten bir işlem çalışıyor.');
    process.exit(1);
}
fs.writeFileSync(pidFile, process.pid.toString());
process.on('exit', () => {
    if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
    }
});
process.on('SIGINT', () => process.exit()); // Ctrl+C yakalama
process.on('SIGTERM', () => process.exit());

const rawPassword = process.env.PG_PASSWORD;
const encodedPassword = encodeURIComponent(rawPassword);
const base = process.env.PG_CONNECTION_STRING_BASE;

const connectionString = base.replace('@', `${encodedPassword}@`);

const viewName = process.env.PG_VIEW_NAME;

const limit = pLimit(10);
const logFile = './sayfa_sureleri_log.txt'; // Süre log dosyası

async function fetchLinksUntilEmpty() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Ana Süreç: Veritabanına bağlandı.');
        await updateProcessStatus(false);

        let hasMoreData = true;
        let emptyTries = 0;
        const maxEmptyTries = 5;
        const waitMs = 5000;

        while (hasMoreData) {
            const pageStartTime = Date.now();

            const res = await client.query(`
                WITH max_sirala AS (
                SELECT MAX(sirala) AS max_sirala
                FROM ${viewName}
                WHERE checker = true
                ),
                parca_araliklari AS (
                SELECT
                    max_sirala,
                    (max_sirala / 5.0) AS parca_boyutu
                FROM max_sirala
                ),
                sirala_sinirlar AS (
                SELECT
                    CEIL(parca_araliklari.parca_boyutu * 3) + 1 AS baslangic,
                    CEIL(parca_araliklari.parca_boyutu * 4) AS bitis
                FROM parca_araliklari
                )
                SELECT
                link, ana_kat, alt_kat1, alt_kat2, marka, urun_kodu, timestamp, sirala, p_adi, checker,sira
                FROM ${viewName}, sirala_sinirlar
                WHERE checker = true
                AND sirala BETWEEN sirala_sinirlar.baslangic AND sirala_sinirlar.bitis
                ORDER BY sirala ASC
                LIMIT 10 OFFSET 0;
            `);

            if (res.rows.length === 0) {
                emptyTries++;
                console.log(`Ana Süreç: Veri yok. ${emptyTries}/${maxEmptyTries} kez denendi.`);

                if (emptyTries >= maxEmptyTries) {
                    console.log('Ana Süreç: Maksimum deneme yapıldı. İşlem tamamlandı.');
                    await updateProcessStatus(true);
                    hasMoreData = false;
                } else {
                    console.log(`Ana Süreç: ${waitMs / 1000} saniye bekleniyor...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                }
            } else {
                emptyTries = 0;
                console.log(`Ana Süreç: ${res.rows.length} kayıt bulundu. Alt süreçler başlatılıyor...`);

                const tasks = res.rows.map(row =>
                    limit(() =>
                        processLinkInChildProcess(
                            row.link,
                            row.ana_kat,
                            row.alt_kat1,
                            row.alt_kat2,
                            row.marka,
                            row.urun_kodu,
                            row.timestamp,
                            row.sira,
                            row.p_adi
                        )
                    )
                );

                try {
                    await Promise.all(tasks);
                    const pageEndTime = Date.now();
                    const pageSeconds = ((pageEndTime - pageStartTime) / 1000).toFixed(2);

                    const logText = `Sayfa ${new Date().toISOString()} tarihinde ${pageSeconds} saniyede tamamlandı.\n`;
                    console.log(`Ana Süreç: ${logText.trim()}`);
                    fs.appendFileSync(logFile, logText);
                } catch (err) {
                    console.error('Ana Süreç: Alt süreçlerde hata oluştu:', err);
                    await updateProcessStatus(true);
                    hasMoreData = false;
                    break;
                }
            }
        }
    } catch (err) {
        console.error('Ana Süreç: Veri çekme hatası:', err);
        await updateProcessStatus(true);
        throw err;
    } finally {
        await client.end();
        console.log('Ana Süreç: Veritabanı bağlantısı kapatıldı.');
    }
}

async function processLinkInChildProcess(link, kategoriAna, kategoriAlt, kategoriAlt2, marka, urun_kodu, timestamp, sira, p_adi) {
    return new Promise((resolve, reject) => {
        console.log(`Ana Süreç: ${urun_kodu} için alt süreç başlatılıyor...`);
        const child = fork('./scrape_api_urunlerim_rakipler.mjs', [
            link, kategoriAna, kategoriAlt, kategoriAlt2, marka, urun_kodu, timestamp, sira, p_adi
        ]);
        console.log(`Ana Süreç: ${urun_kodu} için alt süreç PID: ${child.pid}`);

        child.on('message', (message) => {
            console.log(`Ana Süreç: Alt süreç ${child.pid} (${urun_kodu}) mesaj gönderdi:`, message);
            if (message.status === 'error') {
                console.error(`Ana Süreç: Alt süreç ${child.pid} (${urun_kodu}) hata bildirdi: ${message.message}`);
                reject(new Error(`Alt süreç (${child.pid}) hata bildirdi: ${message.message}`));
            } else {
                resolve(message);
            }
        });

        child.on('error', (err) => {
            console.error(`Ana Süreç: Alt süreç ${child.pid} (${urun_kodu}) başlatılamadı:`, err);
            reject(err);
        });

        child.on('exit', (code) => {
            console.log(`Ana Süreç: Alt süreç ${child.pid} (${urun_kodu}) ${code} koduyla çıktı.`);
            if (code !== 0) {
                reject(new Error(`Alt süreç (${child.pid}) ${code} koduyla çıktı.`));
            } else {
                resolve(`Alt süreç (${child.pid}) başarıyla tamamlandı.`);
            }
        });
    });
}

async function updateProcessStatus(status) {
    console.log(`Ana Süreç: İşlem durumu güncellendi: ${status}`);
}

fetchLinksUntilEmpty().catch(err => {
    console.error('Ana Süreç: Kritik hata:', err);
});