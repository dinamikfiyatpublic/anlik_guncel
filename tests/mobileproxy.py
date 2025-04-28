import os
import requests
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()

# Proxy bilgilerini oku
proxy_ip = os.environ.get("PROXY_IP")
proxy_port = os.environ.get("PROXY_PORT")
proxy_user = os.environ.get("PROXY_USER")
proxy_pass = os.environ.get("PROXY_PASS")

# Proxy ayarlarını oluştur
proxies = {}
if proxy_user and proxy_pass:
    proxies = {
        "http": f"http://{proxy_user}:{proxy_pass}@{proxy_ip}:{proxy_port}",
        "https": f"http://{proxy_user}:{proxy_pass}@{proxy_ip}:{proxy_port}"
    }
else:
    proxies = {
        "http": f"http://{proxy_ip}:{proxy_port}",
        "https": f"http://{proxy_ip}:{proxy_port}"
    }

# Headers ayarı (gerçek tarayıcı gibi)
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/123.0.0.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
}

def test_proxy():
    """Proxy IP'sini ve konumunu kontrol eder"""
    try:
        print("🌍 Proxy IP kontrol ediliyor...")
        response = requests.get("http://ip-api.com/json/", proxies=proxies, headers=headers, timeout=10)
        data = response.json()

        proxy_ip = data['query']
        country = data['country']
        city = data['city']

        print(f"🛰️ Proxy IP: {proxy_ip}")
        print(f"📍 Ülke: {country} | Şehir: {city}")

        if country.lower() == "turkey" or country.lower() == "türkiye":
            print("✅ Proxy Türkiye lokasyonlu.")
        else:
            print("⚠️ Proxy Türkiye dışı lokasyon.")

        return True
    except Exception as e:
        print(f"💣 Proxy testi başarısız: {str(e)}")
        return False

def fetch_html(url):
    """Belirtilen URL'den HTML çeker"""
    try:
        print(f"🌐 URL açılıyor: {url}")
        response = requests.get(url, proxies=proxies, headers=headers, timeout=10)
        response.raise_for_status()
        print("✅ HTML başarıyla alındı!\n")
        print(response.text)
    except Exception as e:
        print(f"💣 HTML çekme hatası: {str(e)}")

if __name__ == "__main__":
    print("🚀 Proxy Üzerinden Kontrol ve HTML Çekme Başlatılıyor...")

    if test_proxy():
        url = "https://www.akakce.com/j/gl/?t=pr&i=100080686&s=0&b=315"
        fetch_html(url)
    else:
        print("❌ Proxy uygun değil, HTML çekme atlandı.")
