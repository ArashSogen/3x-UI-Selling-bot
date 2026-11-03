# 🛡️ FastVPN — Automated 3x-UI Telegram VPN Sales Bot

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![aiogram 3](https://img.shields.io/badge/aiogram-3.x-2CA5E0?logo=telegram&logoColor=white)](https://docs.aiogram.dev/)
[![3x-UI API](https://img.shields.io/badge/3x--UI-REST_API-00C853?logo=cloudflare&logoColor=white)](https://github.com/MHSanaei/3x-ui)
[![SQLite Async](https://img.shields.io/badge/Database-aiosqlite-003B57?logo=sqlite&logoColor=white)](https://github.com/omnilib/aiosqlite)
[![Docker Ready](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A complete, production-ready **Telegram VPN Sales Bot** written in **Python 3.11+** using **aiogram 3** that connects directly to a **3x-UI panel** (Xray-core) via REST API.

Designed for VPN providers who want a clean, English-only storefront with **Bank Card + Receipt Screenshot Verification**, **Internal User Wallet Balances**, **Automated 3x-UI Client Provisioning**, **QR Code Generation**, **Free Trials**, **In-Bot Admin CRUD**, and an integrated **Support Ticket System**.

---

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [🏗️ Architecture & Workflow](#️-architecture--workflow)
- [📂 Project Structure](#-project-structure)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Installation & Setup](#-installation--setup)
  - [Option 1: Docker Compose (Recommended)](#option-1-docker-compose-recommended)
  - [Option 2: Manual Linux VPS & Systemd Service](#option-2-manual-linux-vps--systemd-service)
- [🔐 Environment Variables (`.env`)](#-environment-variables-env)
- [🔌 3x-UI Panel Configuration Guide](#-3x-ui-panel-configuration-guide)
- [📱 User & Admin Commands](#-user--admin-commands)
- [🗄️ Database Schema](#️-database-schema)
- [🔧 Troubleshooting](#-troubleshooting)
- [📄 License](#-license)

---

## ✨ Key Features

### 💳 1. Card + Screenshot Payment System
- **Dynamic Payment Details**: Shows the merchant's **Bank Card Number** and **Cardholder Name** when a customer selects a VPN plan or balance top-up.
- **Editable Inside the Bot**: Admins can change the card number and cardholder name anytime directly from the `/admin` menu without restarting the bot.
- **Receipt Verification Workflow**:
  1. Customer selects a plan or top-up amount and transfers funds to the displayed card.
  2. Customer uploads a photo or document screenshot of the payment receipt.
  3. The bot automatically forwards the screenshot, plan details, amount, and customer info to all configured **Admin Telegram IDs** with inline `[✅ Approve Payment]` and `[❌ Reject Payment]` buttons.
  4. **On Approve**:
     - If the customer bought a **Plan** → automatically creates the client in the connected **3x-UI panel**, generates the connection URI & high-resolution **QR Code**, and sends both to the customer.
     - If the customer requested a **Top-up** → credits the exact amount to the customer's in-bot wallet balance and notifies them.
  5. **On Reject** → updates payment status and notifies the customer with instructions to contact support if needed.

### 📦 2. Full In-Bot Plans Management (Admin CRUD)
- Admins can **Create, Edit, Enable, Disable, and Delete** plans directly inside Telegram.
- **Customizable Plan Attributes**:
  - **Name** (e.g., `1 Month Unlimited VIP`)
  - **Price** (in USD)
  - **Duration (Days)** — supports `0` for non-expiring traffic-only packages.
  - **Traffic (GB)** — supports `0` for unlimited bandwidth packages.
  - **Protocol Type** — links the plan to the target protocol/inbound.
  - **Server ID** — maps to your connected 3x-UI panel.
  - **Status** — toggle `Active` or `Inactive` visibility in the store.
- **Supported Package Models**:
  - Time-based only (Unlimited GB + fixed days)
  - Traffic-based only (Fixed GB + no time expiration)
  - Hybrid (Fixed GB + fixed days)
  - Full Unlimited

### 🌐 3. Multi-Protocol Support & Admin Toggles
- Supports modern anti-censorship and high-speed protocols out of the box:
  - **Tunnel (`VLESS-Reality` with `xtls-rprx-vision`)**
  - **WireGuard-Tunnel (`WireGuard` UDP profile)**
  - **Direct (`VLESS` / `VMess` / `Trojan`)**
- Admins can enable or disable which protocols are displayed to customers in real time from the `/admin` panel.

### 👤 4. Customer Experience & Self-Service
- **Buy Plans**: Purchase via bank card screenshot or instantly using account balance.
- **Wallet & Top-Up**: Maintain an internal USD balance for instant 1-click purchases and renewals.
- **My Configs**: View all active VPN configurations, remaining traffic quota, and expiration dates.
- **QR Code & Raw URI Delivery**: Every configuration includes a scannable PNG QR code and copyable `vless://`, `vmess://`, `trojan://`, or WireGuard config block.
- **Renew & Upgrade**: Extend expiration dates (`+Days`) or add extra bandwidth (`+GB`) to existing 3x-UI clients without changing client keys.
- **Free Trial / Test Account**: 1-click free trial generator (strictly limited to 1 per Telegram user; admin can toggle on/off and configure trial duration & GB).
- **Support Tickets**: Built-in bidirectional ticketing system—customers open tickets and exchange replies with admins directly inside the bot.

### 🛡️ 5. Comprehensive Admin Control Center (`/admin`)
- Protected by hardcoded Telegram IDs (`ADMIN_IDS`).
- **Manage Plans (CRUD)**
- **Edit Card Number & Cardholder Name**
- **1-Tap Approve / Reject Payments**
- **User & Balance Management**: Inspect registered users and manually add or deduct wallet balances (`+10` or `-5`).
- **Free Trial Controls**: Enable/disable free trials and adjust trial days/traffic.
- **Live Statistics**: Track total registered users, total approved sales volume (`$`), total orders, active VPN configurations, pending receipts, and open support tickets.
- **3x-UI Panel Diagnostics**: Live health check and inbound inspection of the connected 3x-UI server.
- **Broadcast System**: Send formatted Markdown announcements to all registered bot users.

---

## 🏗️ Architecture & Workflow

```text
┌────────────────────┐         1. Selects Plan & Uploads Receipt         ┌────────────────────────┐
│   Telegram User    │ ────────────────────────────────────────────────► │  FastVPN Bot (aiogram) │
└────────────────────┘                                                   └───────────┬────────────┘
          ▲                                                                          │
          │                                                    2. Forwards Receipt + │
          │ 5. Delivers Config URI                             [Approve] / [Reject]  │
          │    + Scannable QR Code                                                   ▼
          │                                                              ┌────────────────────────┐
          │                                                              │   Telegram Admin(s)    │
          │                                                              └───────────┬────────────┘
          │                                                                          │
┌─────────┴──────────┐         4. Returns Inbound & Client Details                   │ 3. Clicks [✅ Approve]
│  3x-UI Panel API   │ ◄─────────────────────────────────────────────────────────────┘
│ (Xray-core Server) │         POST /panel/api/inbounds/addClient
└────────────────────┘
```

---

## 📂 Project Structure

```text
bot/
├── main.py                  # Bot entrypoint, startup hooks, polling lifecycle
├── config.py                # Environment variable loader & admin ID validator
├── requirements.txt         # Python dependencies (aiogram, aiohttp, aiosqlite, qrcode)
├── .env.example             # Template for environment variables
├── Dockerfile               # Production container build definition
├── docker-compose.yml       # Docker Compose service with persistent SQLite volume
├── README.md                # Documentation
├── database/
│   └── db.py                # Async SQLite ORM/queries (users, plans, payments, configs, tickets)
├── handlers/
│   ├── user.py              # Customer flows (buy, receipt upload, balance, trial, configs, tickets)
│   └── admin.py             # Admin dashboard, payment verification, plan CRUD, broadcast, stats
├── keyboards/
│   └── inline.py            # Modular InlineKeyboardMarkup builders (English UI)
└── services/
    └── xui_client.py        # Async 3x-UI REST API wrapper, URI builder, QR code generator
```

---

## ⚙️ Prerequisites

1. **Python 3.10+** (or **Docker & Docker Compose**).
2. **Telegram Bot Token**: Create a bot via [@BotFather](https://t.me/BotFather) on Telegram.
3. **Admin Telegram ID(s)**: Get your numeric Telegram ID via [@userinfobot](https://t.me/userinfobot).
4. **3x-UI Panel**: A running instance of [MHSanaei/3x-ui](https://github.com/MHSanaei/3x-ui) accessible via HTTP/HTTPS from your bot server.

---

## 🚀 Installation & Setup

### Option 1: Docker Compose (Recommended)

1. **Prepare the directory and environment file**:
   ```bash
   cd bot
   cp .env.example .env
   nano .env
   ```

2. **Build and launch the container in detached mode**:
   ```bash
   docker compose up -d --build
   ```

3. **Check live logs**:
   ```bash
   docker compose logs -f
   ```

---

### Option 2: Manual Linux VPS & Systemd Service

1. **Install Python and virtual environment tools** (Ubuntu/Debian):
   ```bash
   sudo apt update && sudo apt install -y python3 python3-venv python3-pip
   ```

2. **Set up the virtual environment and install dependencies**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r bot/requirements.txt
   ```

3. **Configure your `.env` file**:
   ```bash
   cp bot/.env.example .env
   nano .env
   ```

4. **Test running the bot**:
   ```bash
   python -m bot.main
   ```

5. **(Optional) Create a `systemd` background service for 24/7 uptime**:
   ```bash
   sudo nano /etc/systemd/system/fastvpn-bot.service
   ```
   Paste the following configuration (adjust `/root/vpn-bot` to your actual path):
   ```ini
   [Unit]
   Description=FastVPN 3x-UI Telegram Bot
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/root/vpn-bot
   EnvironmentFile=/root/vpn-bot/.env
   ExecStart=/root/vpn-bot/venv/bin/python -m bot.main
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable fastvpn-bot
   sudo systemctl start fastvpn-bot
   sudo systemctl status fastvpn-bot
   ```

---

## 🔐 Environment Variables (`.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Telegram Bot token from `@BotFather` | `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ` |
| `ADMIN_IDS` | Comma-separated numeric Telegram IDs of admins | `123456789,987654321` |
| `XUI_URL` | Base URL and port of your 3x-UI panel (no trailing slash) | `https://panel.example.com:2053` |
| `XUI_WEB_BASE_PATH` | Secret web base path configured in 3x-UI (leave empty if `/`) | `mysecretpath` |
| `XUI_USERNAME` | 3x-UI panel admin username | `admin` |
| `XUI_PASSWORD` | 3x-UI panel admin password | `SuperSecretPassword123` |
| `DEFAULT_CARD_NUMBER` | Initial bank card number shown to users | `4400 1234 5678 9012` |
| `DEFAULT_CARD_HOLDER` | Initial cardholder name shown to users | `John Doe (VPN Merchant)` |
| `DATABASE_PATH` | SQLite database file path | `vpn_bot.db` |

---

## 🔌 3x-UI Panel Configuration Guide

To ensure seamless automatic provisioning when payments are approved:

1. Log in to your **3x-UI Web Panel**.
2. Go to **Inbounds** and create at least one inbound for each protocol you offer:
   - **Tunnel (VLESS-Reality)**:
     - Protocol: `vless`
     - Port: `443`
     - Network: `tcp`
     - Security: `reality` (Flow: `xtls-rprx-vision`, SNI: e.g. `zoom.us` or `www.microsoft.com`)
   - **WireGuard-Tunnel**:
     - Protocol: `wireguard`
     - Port: `51820`
   - **Direct**:
     - Protocol: `vless`, `vmess`, or `trojan`
3. The bot's `XUIClient` (`bot/services/xui_client.py`) automatically queries `/panel/api/inbounds/list`, matches the selected plan's protocol to the corresponding inbound, and calls `/panel/api/inbounds/addClient` with the plan's exact byte quota (`totalGB`) and expiration timestamp (`expiryTime`).

---

## 📱 User & Admin Commands

| Command / Action | Access | Description |
| :--- | :--- | :--- |
| `/start` | Everyone | Opens the main user dashboard, displays wallet balance, and shows inline navigation buttons. |
| `/admin` | Admins Only | Opens the Admin Control Center (also accessible via the `🛡️ Admin Control Panel` button for admin IDs). |
| `🛒 Buy VPN Plan` | Everyone | Browse protocols, select a plan, and pay via Bank Card (upload receipt) or Wallet Balance. |
| `💼 My Configs` | Everyone | View active VPN configs, display QR codes, copy raw connection URIs, renew duration, or upgrade traffic. |
| `🎁 Free Trial` | Everyone | Claim a one-time test account (duration and GB configured by admin). |
| `💳 Top-up` | Everyone | Add funds to internal wallet balance by transferring to the admin card and uploading a receipt screenshot. |
| `🎫 Support Ticket` | Everyone | Open a support ticket or reply to an existing conversation with admins. |

---

## 🗄️ Database Schema

The bot uses `aiosqlite` to automatically initialize and manage 7 relational tables on startup (`vpn_bot.db`):

- **`users`**: `id`, `telegram_id`, `username`, `first_name`, `balance`, `trial_claimed`, `created_at`
- **`plans`**: `id`, `name`, `price`, `duration_days`, `traffic_gb`, `protocol`, `server_id`, `is_active`
- **`protocols`**: `key`, `name`, `is_enabled`
- **`payments`**: `id`, `user_id`, `plan_id`, `amount`, `payment_type`, `screenshot_file_id`, `status`, `created_at`
- **`configs`**: `id`, `user_id`, `plan_id`, `client_uuid`, `inbound_id`, `email`, `protocol`, `traffic_limit_bytes`, `expiry_time_ms`, `config_link`, `raw_config`, `is_active`, `created_at`
- **`settings`**: Key-value store for `card_number`, `card_holder`, `trial_enabled`, `trial_days`, `trial_traffic_gb`, `trial_protocol`
- **`tickets` & `ticket_messages`**: Full support ticket thread history between users and admins.

---

## 🔧 Troubleshooting

- **`3x-ui login failed` or `Unreachable` on startup**:
  - Verify `XUI_URL` includes the correct scheme (`http://` or `https://`) and port (e.g., `:2053`).
  - If your 3x-UI panel uses a custom URL root path (Panel Settings → Web Base Path), make sure `XUI_WEB_BASE_PATH` matches it.
  - Note: Self-signed SSL certificates on 3x-UI are supported automatically (`ssl=False` in `aiohttp` requests).
- **Admin buttons or `/admin` says "Access denied"**:
  - Double-check that your numeric Telegram user ID is listed in `ADMIN_IDS` inside `.env` (comma-separated, no spaces or quotes needed).
- **QR codes not rendering**:
  - Ensure `pillow` and `qrcode` are installed (`pip install qrcode pillow`).

---

## 📄 License

This project is licensed under the **MIT License** — free for personal and commercial use.
