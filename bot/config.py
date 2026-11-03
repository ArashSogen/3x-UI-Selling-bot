import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Config:
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
    
    # Comma-separated admin IDs: "123456789,987654321"
    ADMIN_IDS_RAW: str = os.getenv("ADMIN_IDS", "123456789")
    
    @property
    def ADMIN_IDS(self) -> List[int]:
        ids = []
        for x in self.ADMIN_IDS_RAW.split(","):
            x = x.strip()
            if x.isdigit():
                ids.append(int(x))
        return ids

    # 3x-ui Panel API configuration
    XUI_URL: str = os.getenv("XUI_URL", "http://127.0.0.1:2053").rstrip("/")
    XUI_WEB_BASE_PATH: str = os.getenv("XUI_WEB_BASE_PATH", "").strip("/")
    XUI_USERNAME: str = os.getenv("XUI_USERNAME", "admin")
    XUI_PASSWORD: str = os.getenv("XUI_PASSWORD", "admin")

    # Default card payment details
    DEFAULT_CARD_NUMBER: str = os.getenv("DEFAULT_CARD_NUMBER", "4400 1234 5678 9012")
    DEFAULT_CARD_HOLDER: str = os.getenv("DEFAULT_CARD_HOLDER", "John Doe (VPN Merchant)")

    # Database
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "vpn_bot.db")


config = Config()
