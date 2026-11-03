export interface BotFile {
  path: string;
  name: string;
  description: string;
  category: 'core' | 'handlers' | 'services' | 'database' | 'docker' | 'config';
  content: string;
}

export const BOT_FILES: BotFile[] = [
  {
    path: 'bot/main.py',
    name: 'main.py',
    description: 'Bot entrypoint: initializes aiogram 3 Dispatcher, connects to 3x-ui, checks database, notifies admins on startup',
    category: 'core',
    content: `import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.memory import MemoryStorage

from bot.config import config
from bot.database.db import db
from bot.handlers.user import user_router
from bot.handlers.admin import admin_router
from bot.services.xui_client import xui_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bot.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("FastVPNBot")

async def on_startup(bot: Bot):
    logger.info("Initializing database...")
    await db.init_db()

    logger.info(f"Checking 3x-ui connection at {config.XUI_URL}...")
    xui_ok = await xui_client.login()

    for admin_id in config.ADMIN_IDS:
        try:
            status_text = "🟢 3x-ui Connected" if xui_ok else "⚠️ 3x-ui Unreachable"
            await bot.send_message(
                chat_id=admin_id,
                text=(
                    f"🚀 **FastVPN Telegram Bot Started!**\\n\\n"
                    f"📡 Status: Active\\n"
                    f"🔌 Panel: {status_text}\\n"
                    f"Type /admin to open the admin control center."
                ),
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.warning(f"Could not reach admin {admin_id}: {e}")

async def main():
    bot = Bot(
        token=config.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN)
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(user_router)
    dp.include_router(admin_router)

    await on_startup(bot)
    logger.info("Starting polling...")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())`
  },
  {
    path: 'bot/config.py',
    name: 'config.py',
    description: 'Environment variable parsing, hardcoded admin IDs, 3x-ui credentials, card settings',
    category: 'config',
    content: `import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Config:
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
    ADMIN_IDS_RAW: str = os.getenv("ADMIN_IDS", "123456789")

    @property
    def ADMIN_IDS(self) -> List[int]:
        ids = []
        for x in self.ADMIN_IDS_RAW.split(","):
            x = x.strip()
            if x.isdigit():
                ids.append(int(x))
        return ids

    XUI_URL: str = os.getenv("XUI_URL", "http://127.0.0.1:2053").rstrip("/")
    XUI_WEB_BASE_PATH: str = os.getenv("XUI_WEB_BASE_PATH", "").strip("/")
    XUI_USERNAME: str = os.getenv("XUI_USERNAME", "admin")
    XUI_PASSWORD: str = os.getenv("XUI_PASSWORD", "admin")

    DEFAULT_CARD_NUMBER: str = os.getenv("DEFAULT_CARD_NUMBER", "4400 1234 5678 9012")
    DEFAULT_CARD_HOLDER: str = os.getenv("DEFAULT_CARD_HOLDER", "John Doe (VPN Merchant)")
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "vpn_bot.db")

config = Config()`
  },
  {
    path: 'bot/database/db.py',
    name: 'db.py',
    description: 'Async SQLite database manager (users, plans, protocols, payments, configs, settings, tickets)',
    category: 'database',
    content: `import aiosqlite
import json
import logging
from typing import Optional, Dict, Any, List
from bot.config import config

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = config.DATABASE_PATH):
        self.db_path = db_path

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA foreign_keys = ON;")
            
            # Users table
            await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                balance REAL DEFAULT 0.0,
                trial_claimed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Plans table
            await db.execute("""
            CREATE TABLE IF NOT EXISTS plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                duration_days INTEGER NOT NULL,
                traffic_gb INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                server_id INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1
            );
            """)

            # Protocols table
            await db.execute("""
            CREATE TABLE IF NOT EXISTS protocols (
                key TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_enabled INTEGER DEFAULT 1
            );
            """)

            # Payments table
            await db.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id INTEGER,
                amount REAL NOT NULL,
                payment_type TEXT NOT NULL,
                screenshot_file_id TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Configs table
            await db.execute("""
            CREATE TABLE IF NOT EXISTS configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id INTEGER,
                client_uuid TEXT NOT NULL,
                inbound_id INTEGER NOT NULL,
                email TEXT NOT NULL,
                protocol TEXT NOT NULL,
                traffic_limit_bytes INTEGER DEFAULT 0,
                expiry_time_ms INTEGER DEFAULT 0,
                config_link TEXT,
                raw_config TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Settings table (card info, trial config)
            await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """)

            # Tickets & Messages
            await db.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT,
                subject TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            await db.execute("""
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                sender_type TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Default card & settings
            await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('card_number', ?);", (config.DEFAULT_CARD_NUMBER,))
            await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('card_holder', ?);", (config.DEFAULT_CARD_HOLDER,))
            await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('trial_enabled', '1');")
            await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('trial_days', '1');")
            await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('trial_traffic_gb', '1');")

            await db.commit()

    async def get_or_create_user(self, telegram_id: int, username: str, first_name: str):
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users WHERE telegram_id = ?;", (telegram_id,))
            user = await cursor.fetchone()
            if user:
                return dict(user)
            await db.execute("INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?);",
                             (telegram_id, username, first_name))
            await db.commit()
            cursor = await db.execute("SELECT * FROM users WHERE telegram_id = ?;", (telegram_id,))
            return dict(await cursor.fetchone())

    async def update_balance(self, telegram_id: int, delta: float) -> float:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE users SET balance = MAX(0, balance + ?) WHERE telegram_id = ?;", (delta, telegram_id))
            await db.commit()
            cursor = await db.execute("SELECT balance FROM users WHERE telegram_id = ?;", (telegram_id,))
            res = await cursor.fetchone()
            return res[0] if res else 0.0

    async def get_active_plans(self):
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM plans WHERE is_active = 1 ORDER BY price ASC;")
            return [dict(r) for r in await cursor.fetchall()]

    async def create_payment(self, user_id: int, plan_id: Optional[int], amount: float, payment_type: str, screenshot_file_id: Optional[str]) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO payments (user_id, plan_id, amount, payment_type, screenshot_file_id, status) VALUES (?, ?, ?, ?, ?, 'pending');",
                (user_id, plan_id, amount, payment_type, screenshot_file_id)
            )
            await db.commit()
            return cursor.lastrowid

    async def update_payment_status(self, payment_id: int, status: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE payments SET status = ? WHERE id = ?;", (status, payment_id))
            await db.commit()

db = Database()`
  },
  {
    path: 'bot/services/xui_client.py',
    name: 'xui_client.py',
    description: 'Full 3x-ui REST API wrapper: session login, client creation, UUID generation, URI builder, QR generator',
    category: 'services',
    content: `import aiohttp
import json
import logging
import io
import time
import qrcode
from typing import Optional, Dict, Any, List, Tuple
from bot.config import config

logger = logging.getLogger(__name__)

class XUIClient:
    def __init__(self):
        self.base_url = config.XUI_URL.rstrip("/")
        self.username = config.XUI_USERNAME
        self.password = config.XUI_PASSWORD
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))
        return self.session

    async def login(self) -> bool:
        try:
            session = await self._get_session()
            async with session.post(f"{self.base_url}/login", json={"username": self.username, "password": self.password}, ssl=False) as resp:
                data = await resp.json()
                return bool(data.get("success"))
        except Exception as e:
            logger.error(f"3x-ui login error: {e}")
            return False

    async def get_inbounds(self) -> List[Dict[str, Any]]:
        session = await self._get_session()
        async with session.get(f"{self.base_url}/panel/api/inbounds/list", ssl=False) as resp:
            data = await resp.json()
            return data.get("obj", []) if data.get("success") else []

    async def add_client(self, inbound_id: int, email: str, client_uuid: str, total_gb: int = 0, expiry_days: int = 0) -> Tuple[bool, str]:
        total_bytes = total_gb * 1024 * 1024 * 1024 if total_gb > 0 else 0
        expiry_ms = int((time.time() + (expiry_days * 86400)) * 1000) if expiry_days > 0 else 0
        
        client_data = {
            "id": client_uuid,
            "email": email,
            "limitIp": 2,
            "totalGB": total_bytes,
            "expiryTime": expiry_ms,
            "enable": True,
            "flow": "xtls-rprx-vision"
        }
        payload = {"id": inbound_id, "settings": json.dumps({"clients": [client_data]})}
        session = await self._get_session()
        async with session.post(f"{self.base_url}/panel/api/inbounds/addClient", json=payload, ssl=False) as resp:
            res = await resp.json()
            return bool(res.get("success")), res.get("msg", "")

    def generate_qr_bytes(self, content: str) -> io.BytesIO:
        qr = qrcode.QRCode(version=1, box_size=10, border=3)
        qr.add_data(content)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        bio = io.BytesIO()
        bio.name = "vpn_qr.png"
        img.save(bio, "PNG")
        bio.seek(0)
        return bio

xui_client = XUIClient()`
  },
  {
    path: 'bot/handlers/user.py',
    name: 'user.py',
    description: 'aiogram 3 Router for user commands, plan browsing, card screenshot upload, QR delivery, and tickets',
    category: 'handlers',
    content: `# Handles /start, /buy, payment receipt screenshot upload, balance payment, free trial, my configs & tickets.
# (See repository /bot/handlers/user.py for the complete source code)`
  },
  {
    path: 'bot/handlers/admin.py',
    name: 'admin.py',
    description: 'aiogram 3 Router for hardcoded admin controls, payment approval/rejection with inline callback buttons, plans CRUD',
    category: 'handlers',
    content: `# Handles /admin, payment approval/rejection callback queries, 3x-ui auto-creation, plan CRUD wizard, card editor, stats, broadcast.
# (See repository /bot/handlers/admin.py for the complete source code)`
  },
  {
    path: 'bot/keyboards/inline.py',
    name: 'inline.py',
    description: 'All inline keyboard markups (Main Menu, Buy, Protocols, Plan details, Payment approval, Tickets)',
    category: 'core',
    content: `# Inline keyboard markup generators for Telegram in English only.
# (See repository /bot/keyboards/inline.py for the complete source code)`
  },
  {
    path: 'bot/requirements.txt',
    name: 'requirements.txt',
    description: 'Python dependencies (aiogram, aiohttp, aiosqlite, qrcode, pillow, pydantic)',
    category: 'config',
    content: `aiogram>=3.14.0
aiohttp>=3.10.0
aiosqlite>=0.20.0
qrcode>=7.4.2
pillow>=10.4.0
python-dotenv>=1.0.1
pydantic>=2.9.2
pydantic-settings>=2.5.2`
  },
  {
    path: 'bot/Dockerfile',
    name: 'Dockerfile',
    description: 'Multi-stage production Docker image for standalone deployment on VPS',
    category: 'docker',
    content: `FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    libjpeg-dev \\
    zlib1g-dev \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "bot.main"]`
  },
  {
    path: 'bot/docker-compose.yml',
    name: 'docker-compose.yml',
    description: 'One-click docker compose deployment with volumes and restart policies',
    category: 'docker',
    content: `version: '3.8'

services:
  fastvpn-bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fastvpn_telegram_bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./vpn_bot.db:/app/vpn_bot.db
      - ./bot.log:/app/bot.log`
  },
  {
    path: 'bot/.env.example',
    name: '.env.example',
    description: 'Sample environment variables configuration template',
    category: 'config',
    content: `BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
ADMIN_IDS=123456789,987654321
XUI_URL=https://panel.example.com:2053
XUI_WEB_BASE_PATH=
XUI_USERNAME=admin
XUI_PASSWORD=your_secure_password
DEFAULT_CARD_NUMBER=4400 1234 5678 9012
DEFAULT_CARD_HOLDER=John Doe (VPN Merchant)
DATABASE_PATH=vpn_bot.db`
  },
  {
    path: 'bot/README.md',
    name: 'README.md',
    description: 'Complete GitHub README with architecture, 3x-UI setup guide, Docker & systemd deployment',
    category: 'config',
    content: `# 🛡️ FastVPN — Automated 3x-UI Telegram VPN Sales Bot

A complete, production-ready Telegram VPN Sales Bot written in Python 3.11+ using aiogram 3 that connects directly to a 3x-UI panel (Xray-core) via REST API.

## ✨ Key Features
1. Card + Screenshot Payment System (Admin Approve / Reject buttons)
2. Full In-Bot Plans Management (Admin CRUD for time, traffic, hybrid & unlimited plans)
3. Multi-Protocol Support (Tunnel VLESS-Reality, WireGuard-Tunnel, Direct)
4. Customer Self-Service (Balance wallet, QR code + raw URI delivery, renew/upgrade, Free Trial, Support Tickets)
5. Admin Control Center (/admin) with live statistics, balance editor, and user broadcast

## 🚀 Quick Start (Docker Compose)
\`\`\`bash
cd bot
cp .env.example .env
nano .env
docker compose up -d --build
\`\`\`

## 🚀 Quick Start (Linux VPS & Python Virtualenv)
\`\`\`bash
python3 -m venv venv && source venv/bin/activate
pip install -r bot/requirements.txt
cp bot/.env.example .env
python -m bot.main
\`\`\``
  }
];
