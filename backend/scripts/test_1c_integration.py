import sys
import os
import requests
from requests.auth import HTTPBasicAuth
import urllib.parse

def test_1c(url, username, password):
    # Encoding URL to handle Cyrillic characters properly
    parsed = urllib.parse.urlparse(url)
    encoded_path = urllib.parse.quote(parsed.path)
    final_url = urllib.parse.urlunparse(parsed._replace(path=encoded_path))
    
    print(f"Testing connection to (Encoded): {final_url}")
    try:
        response = requests.get(final_url, auth=HTTPBasicAuth(username, password), timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Server: {response.headers.get('Server', 'Unknown')}")
        
        if response.status_code == 200:
            print("--- SUCCESS ---")
            print("Response text:")
            print(response.text)
        elif response.status_code == 401:
            print("--- ERROR: 401 Unauthorized ---")
            print("Сервер 1С отклонил логин/пароль. Проверьте пользователя в 1С.")
            print(f"WWW-Authenticate: {response.headers.get('WWW-Authenticate', 'None')}")
        elif response.status_code == 404:
            print("--- ERROR: 404 Not Found ---")
            print("Путь не найден. Проверьте имя базы, имя сервиса (/hs/...) и шаблоны URL в 1С.")
        else:
            print(f"--- FAILED (Status: {response.status_code}) ---")
            print(f"Error Body: {response.text[:200]}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_1c_integration.py <URL> [username] [password]")
        sys.exit(1)
    
    url = sys.argv[1]
    user = sys.argv[2] if len(sys.argv) > 2 else ""
    pwd = sys.argv[3] if len(sys.argv) > 3 else ""
    
    test_1c(url, user, pwd)
