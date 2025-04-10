import json

import requests

def send_request():
    host = "api.scrapeless.com"
    url = f"https://{host}/api/v1/unlocker/request"
    token = "xxxxxxxxxxxx"

    headers = {
        "x-api-token": token
    }

    json_payload = json.dumps({
        "actor": "unlocker.webunlocker",
        "proxy": {
            "country": "ANY"
        },
        "input": {
            "url": "https://api6.akakce.com/quickview/getall?prCodes=321437397",
            "method": "GET",
            "redirect": False,
            "headless": False,
            "js_render": False,
            "js_instructions": [{"wait":10000},{"wait_for":[".dynamic-content",30000]},{"click":["#load-more",1000]},{"fill":["#search-input","search term"]},{"keyboard":["press","Enter"]},{"evaluate":"window.scrollTo(0, document.body.scrollHeight)"}],
            "block": {"resources":["image","font","script"],"urls":["https://example.com"]}
        }
    })

    response = requests.post(url, headers=headers, data=json_payload)

    if response.status_code != 200:
        print("Error:", response.status_code, response.text)
        return

    print("body", response.text)


if __name__ == "__main__":
    send_request()