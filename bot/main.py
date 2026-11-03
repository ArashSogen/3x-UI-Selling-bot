import asyncio
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

# Configure logging
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
    """Run tasks when the bot starts up."""
    logger.info("Initializing database...")
    await db.init_db()

    logger.info(f"Checking 3x-ui connection at {config.XUI_URL}...")
    xui_ok = await xui_client.login()
    if xui_ok:
        logger.info("3x-ui panel logged in successfully.")
    else:
        logger.warning("Could not establish connection to 3x-ui panel. Please verify credentials in .env.")

    # Alert admins
    for admin_id in config.ADMIN_IDS:
        try:
            status_text = "🟢 3x-ui Connected" if xui_ok else "⚠️ 3x-ui Unreachable"
            await bot.send_message(
                chat_id=admin_id,
                text=(
                    f"🚀 **FastVPN Telegram Bot Started!**\n\n"
                    f"📡 Status: Active\n"
                    f"🔌 Panel: {status_text}\n"
                    f"Type /admin to open the admin control center."
                ),
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.warning(f"Could not reach admin {admin_id} on startup: {e}")


async def main():
    if not config.BOT_TOKEN or config.BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.error("FATAL: BOT_TOKEN is not set in .env or environment! Please configure it.")
        print("\n[!] Please set your BOT_TOKEN in .env or config.py before running.\n")
        return

    bot = Bot(
        token=config.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN)
    )
    dp = Dispatcher(storage=MemoryStorage())

    # Register handlers
    dp.include_router(user_router)
    dp.include_router(admin_router)

    # Startup event
    await on_startup(bot)

    logger.info("Starting polling...")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()
        if xui_client.session and not xui_client.session.closed:
            await xui_client.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("FastVPN Bot stopped gracefully.")
