import logging
import requests
from requests.auth import HTTPBasicAuth
from typing import List, Optional, Dict, Any

logger = logging.getLogger("fot.onec")

class OneCService:
    def __init__(self, base_url: str, username: Optional[str] = None, password: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        # Even an empty string is a valid password for Basic Auth if a username exists
        self.auth = HTTPBasicAuth(username, password or "") if username else None

    def get_employees(self) -> List[str]:
        """
        Calls 1C HTTP service to get employee list.
        URL structure: {base_url}/hs/mybase/get_fio
        """
        # Construction logic
        base = self.base_url.rstrip("/")
        
        if "/hs/" in base:
            # User entered full path e.g. http://.../mybase/hs/mybase
            url = f"{base}/get_fio"
        elif base.endswith("/mybase"):
            # User entered base with base name e.g. http://.../mybase
            url = f"{base}/hs/mybase/get_fio"
        else:
            # User entered only domain e.g. http://localhost
            # We assume the base name is also 'mybase' based on screenshots
            url = f"{base}/mybase/hs/mybase/get_fio"
        
        print(f"DEBUG: Connecting to 1C URL: {url}")
        
        try:
            response = requests.get(url, auth=self.auth, timeout=10)
            if response.status_code == 404:
                raise Exception(f"404 Not Found по адресу: {url}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch employees from 1C: {e}")
            raise e

    def test_connection(self) -> bool:
        """
        Simple connection test. Raises exception if fails.
        """
        self.get_employees()
        return True
