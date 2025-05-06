import os
import time
import logging
import psycopg2
import requests
from urllib.parse import quote_plus
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()

# Logging ayarları
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Ortam değişkenleri
github_token = os.getenv('MY_GITHUB_TOKEN')
db_user = os.getenv('PG_DB_USER')
db_password = os.getenv('PG_PASSWORD')
db_host = os.getenv('PG_HOST')
db_port = os.getenv('PG_PORT')
db_name = os.getenv('PG_NAME')

# Parolayı güvenli şekilde şifrele
encoded_password = quote_plus(db_password)

# PostgreSQL bağlantı string'i
connection_string = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"

# Supabase'den kalan kayıt sayısını kontrol et
def check_supabase():
    try:
        with psycopg2.connect(connection_string) as conn:
            with conn.cursor() as cur:
                logging.info('Veritabanına bağlanıldı.')
                cur.execute("SELECT COUNT(*) FROM dinamik_akakce_kategoriler_ana_linkler_kalan_yeni;")
                result = cur.fetchone()
                scrape_kalan = result[0] if result else 0
                logging.info(f"kalan adet: {scrape_kalan}")
                return scrape_kalan
    except Exception as e:
        logging.error(f"Sorgu çalıştırılamadı: {e}")
        return None

# Workflow tetikle
def trigger_workflow(workflow_name):
    response = requests.post(
        f"https://api.github.com/repos/dinamikfiyatpublic/anlik_guncel/actions/workflows/{workflow_name}/dispatches",
        json={"ref": "main"},
        headers={"Authorization": f"token {github_token}"}
    )
    if response.status_code == 204:
        logging.info(f"Workflow '{workflow_name}' başarıyla tetiklendi.")
        time.sleep(5)
    else:
        logging.error(f"Workflow tetiklenemedi: {response.status_code} - {response.text}")
    return response

# Çalışan workflow'ları kontrol et
def check_running_workflows():
    response = requests.get(
        "https://api.github.com/repos/dinamikfiyatpublic/anlik_guncel/actions/runs",
        headers={"Authorization": f"token {github_token}"}
    )
    if response.status_code != 200:
        logging.error(f"Workflow listesi alınamadı: {response.status_code} - {response.text}")
        return []

    runs = response.json().get("workflow_runs", [])
    return [run for run in runs if run["status"] == "in_progress"]

# Belirli bir workflow adının çalışmasının bitmesini bekle
def wait_for_workflow_completion(workflow_display_name):
    while True:
        running = check_running_workflows()
        names = [run['name'] for run in running]
        logging.info(f"Aktif workflow'lar: {names}")
        if not any(run['name'] == workflow_display_name for run in running):
            logging.info(f"'{workflow_display_name}' tamamlandı.")
            return
        logging.info(f"'{workflow_display_name}' hala çalışıyor. Bekleniyor...")
        time.sleep(10)

def main():
    workflow_file = "concurrent_run_api_matrix.yml"
    workflow_display_name = "concurrent_run_api_matrix"  # GitHub'da görünen isim

    while True:
        scrape_kalan = check_supabase()
        if scrape_kalan is None:
            logging.error("scrape_kalan değeri alınamadı. Yeniden denenecek.")
            time.sleep(30)
            continue

        if scrape_kalan <= 0:
            logging.info("İşlenecek veri kalmadı. Çıkılıyor.")
            break

        # Çalışan workflow var mı kontrol et
        running = check_running_workflows()
        if any(run["name"] == workflow_display_name for run in running):
            logging.info("Workflow zaten çalışıyor. Bekleniyor...")
            time.sleep(15)
            continue

        # Workflow'u tetikle
        logging.info(f"{scrape_kalan} kayıt kaldı. Workflow tetikleniyor: {workflow_file}")
        trigger_workflow(workflow_file)

        # Workflow tamamlanana kadar bekle
        wait_for_workflow_completion(workflow_display_name)

        # Yeni scrape_kalan kontrolü bir sonraki döngüde yapılacak
        time.sleep(10)

if __name__ == "__main__":
    main()
