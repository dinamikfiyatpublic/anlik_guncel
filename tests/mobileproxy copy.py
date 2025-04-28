import os
import requests
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()


proxy_ip = os.environ.get("PROXY_IP")  # Ortam değişkeninden IP adresini al
proxy_port = os.environ.get("PROXY_PORT")  # Ortam değişkeninden port numarasını al
proxy_user = os.environ.get("PROXY_USER")  # Ortam değişkeninden kullanıcı adını al
proxy_pass = os.environ.get("PROXY_PASS")  # Ortam değişkeninden şifreyi al

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

def test_proxy():
    try:
        # Test isteği (Proxy'siz)
        normal_ip = requests.get("http://ip-api.com/json/", timeout=5).json()['query']
        print(f"🔴 Normal IP: {normal_ip}")

        # Test isteği (Proxy'li)
        response = requests.get("http://ip-api.com/json/", proxies=proxies, timeout=10)
        data = response.json()
        
        if response.status_code == 200:
            print(f"🟢 Proxy IP: {data['query']}")
            print(f"📍 Konum: {data['country']} - {data['city']}")
            return True
        else:
            print(f"❌ Hata: {response.status_code} | {data.get('message', '')}")
            return False

    except requests.exceptions.ProxyError as e:
        print(f"🔥 Proxy Hatası: {str(e)}")
        print("Çözüm: 1) Proxy IP/Port kontrol edin 2) Kimlik doğrulama gerekiyor mu?")
        return False
    except requests.exceptions.ConnectTimeout:
        print("⌛ Bağlantı zaman aşımı: Proxy erişilemiyor")
        print("Çözüm: 1) Telefonunuzda proxy çalışıyor mu? 2) Port açık mı?")
        return False
    except Exception as e:
        print(f"💣 Beklenmeyen Hata: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Proxy Test Başlatılıyor...")
    if test_proxy():
        print("✅ Proxy Başarıyla Çalışıyor!")
    else:
        print("❌ Proxy Bağlantısı Başarısız")