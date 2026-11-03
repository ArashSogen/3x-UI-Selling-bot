import aiosqlite
import json
import logging
from typing import Optional, Dict, Any, List
from bot.config import config

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, db_path: str = config.DATABASE_PATH):
        self.db_path = db_path

    async def init_db(self):
        """Initialize all required SQLite tables and default settings."""
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
                payment_type TEXT NOT NULL, -- 'plan' or 'topup'
                screenshot_file_id TEXT,
                status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (telegram_id)
            );
            """)

            # Active Configs table
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (telegram_id)
            );
            """)

            # Bot Settings (card info, free trial params, etc.)
            await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """)

            # Support tickets
            await db.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT,
                subject TEXT NOT NULL,
                status TEXT DEFAULT 'open', -- 'open', 'resolved', 'closed'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Support ticket messages
            await db.execute("""
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                sender_type TEXT NOT NULL, -- 'user' or 'admin'
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            );
            """)

            # Insert default settings if missing
            defaults = {
                "card_number": config.DEFAULT_CARD_NUMBER,
                "card_holder": config.DEFAULT_CARD_HOLDER,
                "trial_enabled": "1",
                "trial_days": "1",
                "trial_traffic_gb": "1",
                "trial_protocol": "Tunnel"
            }
            for k, v in defaults.items():
                await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);", (k, v))

            # Default protocols
            default_protocols = [
                ("tunnel", "Tunnel (VLESS-Reality)", 1),
                ("wireguard", "WireGuard-Tunnel", 1),
                ("direct", "Direct (VLESS / VMess / Trojan)", 1)
            ]
            for p_key, p_name, p_enabled in default_protocols:
                await db.execute("INSERT OR IGNORE INTO protocols (key, name, is_enabled) VALUES (?, ?, ?);",
                                 (p_key, p_name, p_enabled))

            # Insert starter plans if empty
            cursor = await db.execute("SELECT COUNT(*) FROM plans;")
            count = (await cursor.fetchone())[0]
            if count == 0:
                seed_plans = [
                    ("1 Month Unlimited", 5.0, 30, 0, "Tunnel (VLESS-Reality)", 1, 1),
                    ("3 Months Unlimited", 12.0, 90, 0, "Tunnel (VLESS-Reality)", 1, 1),
                    ("50 GB Traffic Only", 3.0, 0, 50, "Direct (VLESS / VMess / Trojan)", 1, 1),
                    ("WireGuard 100 GB (30 Days)", 7.0, 30, 100, "WireGuard-Tunnel", 1, 1),
                ]
                for p in seed_plans:
                    await db.execute(
                        "INSERT INTO plans (name, price, duration_days, traffic_gb, protocol, server_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?);",
                        p
                    )

            await db.commit()
            logger.info("Database schema initialized successfully.")

    # User operations
    async def get_or_create_user(self, telegram_id: int, username: Optional[str], first_name: Optional[str]) -> Dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users WHERE telegram_id = ?;", (telegram_id,))
            user = await cursor.fetchone()
            if user:
                # Update username/first_name if changed
                await db.execute("UPDATE users SET username = ?, first_name = ? WHERE telegram_id = ?;",
                                 (username, first_name, telegram_id))
                await db.commit()
                return dict(user)
            
            await db.execute("INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?);",
                             (telegram_id, username, first_name))
            await db.commit()
            cursor = await db.execute("SELECT * FROM users WHERE telegram_id = ?;", (telegram_id,))
            new_user = await cursor.fetchone()
            return dict(new_user)

    async def get_user(self, telegram_id: int) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users WHERE telegram_id = ?;", (telegram_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_all_users(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users ORDER BY id DESC;")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def update_balance(self, telegram_id: int, amount_delta: float) -> float:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE users SET balance = MAX(0, balance + ?) WHERE telegram_id = ?;",
                             (amount_delta, telegram_id))
            await db.commit()
            cursor = await db.execute("SELECT balance FROM users WHERE telegram_id = ?;", (telegram_id,))
            res = await cursor.fetchone()
            return res[0] if res else 0.0

    async def mark_trial_claimed(self, telegram_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE users SET trial_claimed = 1 WHERE telegram_id = ?;", (telegram_id,))
            await db.commit()

    # Settings operations
    async def get_setting(self, key: str, default: str = "") -> str:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT value FROM settings WHERE key = ?;", (key,))
            res = await cursor.fetchone()
            return res[0] if res else default

    async def set_setting(self, key: str, value: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);", (key, value))
            await db.commit()

    # Plans operations
    async def get_active_plans(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM plans WHERE is_active = 1 ORDER BY price ASC;")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_all_plans(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM plans ORDER BY id ASC;")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_plan(self, plan_id: int) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM plans WHERE id = ?;", (plan_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def create_plan(self, name: str, price: float, duration_days: int, traffic_gb: int, protocol: str, server_id: int = 1) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO plans (name, price, duration_days, traffic_gb, protocol, server_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1);",
                (name, price, duration_days, traffic_gb, protocol, server_id)
            )
            await db.commit()
            return cursor.lastrowid

    async def update_plan(self, plan_id: int, **kwargs):
        async with aiosqlite.connect(self.db_path) as db:
            fields = []
            values = []
            for k, v in kwargs.items():
                fields.append(f"{k} = ?")
                values.append(v)
            values.append(plan_id)
            await db.execute(f"UPDATE plans SET {', '.join(fields)} WHERE id = ?;", tuple(values))
            await db.commit()

    async def delete_plan(self, plan_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM plans WHERE id = ?;", (plan_id,))
            await db.commit()

    # Protocols
    async def get_protocols(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM protocols ORDER BY key ASC;")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def toggle_protocol(self, key: str, is_enabled: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE protocols SET is_enabled = ? WHERE key = ?;", (is_enabled, key))
            await db.commit()

    # Payments
    async def create_payment(self, user_id: int, plan_id: Optional[int], amount: float, payment_type: str, screenshot_file_id: Optional[str]) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO payments (user_id, plan_id, amount, payment_type, screenshot_file_id, status) VALUES (?, ?, ?, ?, ?, 'pending');",
                (user_id, plan_id, amount, payment_type, screenshot_file_id)
            )
            await db.commit()
            return cursor.lastrowid

    async def get_payment(self, payment_id: int) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM payments WHERE id = ?;", (payment_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def update_payment_status(self, payment_id: int, status: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE payments SET status = ? WHERE id = ?;", (status, payment_id))
            await db.commit()

    # Configs
    async def create_user_config(self, user_id: int, plan_id: Optional[int], client_uuid: str, inbound_id: int,
                                 email: str, protocol: str, traffic_limit_bytes: int, expiry_time_ms: int,
                                 config_link: str, raw_config: str) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """INSERT INTO configs (user_id, plan_id, client_uuid, inbound_id, email, protocol, traffic_limit_bytes, expiry_time_ms, config_link, raw_config, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);""",
                (user_id, plan_id, client_uuid, inbound_id, email, protocol, traffic_limit_bytes, expiry_time_ms, config_link, raw_config)
            )
            await db.commit()
            return cursor.lastrowid

    async def get_user_configs(self, user_id: int) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM configs WHERE user_id = ? AND is_active = 1 ORDER BY id DESC;", (user_id,))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_all_configs(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM configs ORDER BY id DESC;")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_config_by_id(self, config_id: int) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM configs WHERE id = ?;", (config_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def update_config_extension(self, config_id: int, add_bytes: int, add_expiry_ms: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """UPDATE configs 
                   SET traffic_limit_bytes = traffic_limit_bytes + ?,
                       expiry_time_ms = CASE WHEN expiry_time_ms = 0 THEN ? ELSE expiry_time_ms + ? END
                   WHERE id = ?;""",
                (add_bytes, add_expiry_ms, add_expiry_ms, config_id)
            )
            await db.commit()

    async def deactivate_config(self, config_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE configs SET is_active = 0 WHERE id = ?;", (config_id,))
            await db.commit()

    # Statistics
    async def get_statistics(self) -> Dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            # Total users
            cur = await db.execute("SELECT COUNT(*) FROM users;")
            total_users = (await cur.fetchone())[0]

            # Total sales & count
            cur = await db.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0.0) FROM payments WHERE status = 'approved';")
            row = await cur.fetchone()
            total_sales_count, total_sales_volume = row[0], row[1]

            # Active configs
            cur = await db.execute("SELECT COUNT(*) FROM configs WHERE is_active = 1;")
            active_configs = (await cur.fetchone())[0]

            # Pending payments
            cur = await db.execute("SELECT COUNT(*) FROM payments WHERE status = 'pending';")
            pending_payments = (await cur.fetchone())[0]

            # Open tickets
            cur = await db.execute("SELECT COUNT(*) FROM tickets WHERE status = 'open';")
            open_tickets = (await cur.fetchone())[0]

            return {
                "total_users": total_users,
                "total_sales_count": total_sales_count,
                "total_sales_volume": round(total_sales_volume, 2),
                "active_configs": active_configs,
                "pending_payments": pending_payments,
                "open_tickets": open_tickets
            }

    # Tickets
    async def create_ticket(self, user_id: int, user_name: str, subject: str, message: str) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO tickets (user_id, user_name, subject, status) VALUES (?, ?, ?, 'open');",
                (user_id, user_name, subject)
            )
            ticket_id = cursor.lastrowid
            await db.execute(
                "INSERT INTO ticket_messages (ticket_id, sender_type, text) VALUES (?, 'user', ?);",
                (ticket_id, message)
            )
            await db.commit()
            return ticket_id

    async def add_ticket_message(self, ticket_id: int, sender_type: str, text: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO ticket_messages (ticket_id, sender_type, text) VALUES (?, ?, ?);",
                (ticket_id, sender_type, text)
            )
            if sender_type == 'admin':
                await db.execute("UPDATE tickets SET status = 'open' WHERE id = ?;", (ticket_id,))
            await db.commit()

    async def get_tickets(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if status:
                cursor = await db.execute("SELECT * FROM tickets WHERE status = ? ORDER BY id DESC;", (status,))
            else:
                cursor = await db.execute("SELECT * FROM tickets ORDER BY id DESC;")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_user_tickets(self, user_id: int) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC;", (user_id,))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_ticket(self, ticket_id: int) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM tickets WHERE id = ?;", (ticket_id,))
            ticket = await cursor.fetchone()
            if not ticket:
                return None
            
            # Fetch messages
            cursor = await db.execute("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC;", (ticket_id,))
            messages = await cursor.fetchall()
            result = dict(ticket)
            result["messages"] = [dict(m) for m in messages]
            return result

    async def close_ticket(self, ticket_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("UPDATE tickets SET status = 'resolved' WHERE id = ?;", (ticket_id,))
            await db.commit()


db = Database()
