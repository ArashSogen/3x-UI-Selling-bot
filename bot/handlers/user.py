import uuid
import logging
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, BufferedInputFile
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.config import config
from bot.database.db import db
from bot.services.xui_client import xui_client
from bot.keyboards.inline import (
    get_main_menu,
    get_protocols_keyboard,
    get_plans_keyboard,
    get_payment_methods_keyboard,
    get_admin_approval_keyboard,
    get_config_detail_keyboard,
    get_ticket_user_keyboard
)

logger = logging.getLogger(__name__)
user_router = Router()


class UserOrderState(StatesGroup):
    waiting_for_plan_receipt = State()
    waiting_for_topup_amount = State()
    waiting_for_topup_receipt = State()
    waiting_for_ticket_subject = State()
    waiting_for_ticket_message = State()
    waiting_for_ticket_reply = State()


@user_router.message(CommandStart())
async def handle_start(message: Message, state: FSMContext):
    """Handle /start command."""
    await state.clear()
    user = await db.get_or_create_user(
        telegram_id=message.from_user.id,
        username=message.from_user.username,
        first_name=message.from_user.first_name
    )
    
    welcome_text = (
        f"👋 Welcome to **FastVPN Services**, {message.from_user.first_name}!\n\n"
        f"🔒 High-speed, secure, and uncensored internet connection.\n"
        f"⚡ Protocols supported: Tunnel (VLESS-Reality), WireGuard-Tunnel, and Direct.\n\n"
        f"💰 **Your Balance:** `${user['balance']:.2f}`\n\n"
        f"Choose an option from the menu below to get started:"
    )
    await message.answer(
        welcome_text,
        reply_markup=get_main_menu(message.from_user.id, user["balance"]),
        parse_mode="Markdown"
    )


@user_router.callback_query(F.data == "menu_main")
async def handle_menu_main(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    user = await db.get_user(callback.from_user.id)
    balance = user["balance"] if user else 0.0
    
    await callback.message.edit_text(
        f"👋 **FastVPN Main Dashboard**\n\n"
        f"💰 **Your Balance:** `${balance:.2f}`\n\n"
        f"Select an action below:",
        reply_markup=get_main_menu(callback.from_user.id, balance),
        parse_mode="Markdown"
    )
    await callback.answer()


# ----------------------------------------------------
# BUYING PLANS
# ----------------------------------------------------

@user_router.callback_query(F.data == "user_buy")
async def handle_user_buy(callback: CallbackQuery):
    protocols = await db.get_protocols()
    await callback.message.edit_text(
        "🌐 **Select Your Preferred Protocol / Location:**\n\n"
        "• **Tunnel (VLESS-Reality):** Ultimate anti-filtering & censorship resistance.\n"
        "• **WireGuard-Tunnel:** Ultra-fast speeds for gaming & streaming.\n"
        "• **Direct:** High bandwidth direct routes for unrestricted networks.\n\n"
        "Choose one:",
        reply_markup=get_protocols_keyboard(protocols),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("proto_select_"))
async def handle_proto_select(callback: CallbackQuery):
    proto_key = callback.data.replace("proto_select_", "")
    all_plans = await db.get_active_plans()
    
    # Filter matching protocol or show all if general
    filtered = [p for p in all_plans if proto_key.lower() in p["protocol"].lower()]
    if not filtered:
        filtered = all_plans

    if not filtered:
        await callback.message.edit_text(
            "⚠️ No active plans available for this protocol right now. Please check back soon or contact support.",
            reply_markup=get_main_menu(callback.from_user.id)
        )
        await callback.answer()
        return

    await callback.message.edit_text(
        "📦 **Choose Your VPN Plan:**\n\n"
        "Select the package that fits your needs:",
        reply_markup=get_plans_keyboard(filtered),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("plan_choose_"))
async def handle_plan_choose(callback: CallbackQuery):
    plan_id = int(callback.data.replace("plan_choose_", ""))
    plan = await db.get_plan(plan_id)
    if not plan:
        await callback.answer("Plan not found.", show_alert=True)
        return

    user = await db.get_user(callback.from_user.id)
    user_balance = user["balance"] if user else 0.0

    traffic_str = "Unlimited Traffic" if plan["traffic_gb"] == 0 else f"{plan['traffic_gb']} GB Traffic"
    duration_str = "No Time Limit" if plan["duration_days"] == 0 else f"{plan['duration_days']} Days"

    text = (
        f"🛒 **Plan Summary:**\n\n"
        f"🏷 **Name:** {plan['name']}\n"
        f"🌐 **Protocol:** {plan['protocol']}\n"
        f"📊 **Traffic:** {traffic_str}\n"
        f"⏳ **Duration:** {duration_str}\n"
        f"💵 **Price:** `${plan['price']:.2f}`\n\n"
        f"💰 **Your Balance:** `${user_balance:.2f}`\n\n"
        f"Select your payment method below:"
    )

    await callback.message.edit_text(
        text,
        reply_markup=get_payment_methods_keyboard(plan_id, plan["price"], user_balance),
        parse_mode="Markdown"
    )
    await callback.answer()


# ----------------------------------------------------
# PAYMENT METHODS (BALANCE VS CARD)
# ----------------------------------------------------

@user_router.callback_query(F.data.startswith("pay_balance_"))
async def handle_pay_balance(callback: CallbackQuery, bot: Bot):
    """Direct instant payment from user balance."""
    plan_id = int(callback.data.replace("pay_balance_", ""))
    plan = await db.get_plan(plan_id)
    user = await db.get_user(callback.from_user.id)

    if not plan or not user:
        await callback.answer("Invalid request.", show_alert=True)
        return

    if user["balance"] < plan["price"]:
        await callback.answer("Insufficient balance.", show_alert=True)
        return

    # Deduct balance
    await db.update_balance(callback.from_user.id, -plan["price"])

    # Create config in 3x-ui
    client_uuid = str(uuid.uuid4())
    client_email = f"user_{callback.from_user.id}_{int(plan_id)}"
    
    inbound = await xui_client.get_suitable_inbound(plan["protocol"])
    inbound_id = inbound.get("id", 1) if inbound else 1

    success, msg = await xui_client.add_client(
        inbound_id=inbound_id,
        email=client_email,
        client_uuid=client_uuid,
        total_gb=plan["traffic_gb"],
        expiry_days=plan["duration_days"]
    )

    # Build config string
    config_string = xui_client.build_config_string(inbound or {"port": 443, "protocol": "vless"}, client_uuid, client_email)
    total_bytes = plan["traffic_gb"] * 1024 * 1024 * 1024
    import time
    expiry_ms = int((time.time() + (plan["duration_days"] * 86400)) * 1000) if plan["duration_days"] > 0 else 0

    config_id = await db.create_user_config(
        user_id=callback.from_user.id,
        plan_id=plan["id"],
        client_uuid=client_uuid,
        inbound_id=inbound_id,
        email=client_email,
        protocol=plan["protocol"],
        traffic_limit_bytes=total_bytes,
        expiry_time_ms=expiry_ms,
        config_link=config_string,
        raw_config=config_string
    )

    # Record approved payment
    await db.create_payment(
        user_id=callback.from_user.id,
        plan_id=plan["id"],
        amount=plan["price"],
        payment_type="balance",
        screenshot_file_id=None
    )

    # Generate QR Code image
    qr_bio = xui_client.generate_qr_bytes(config_string)
    photo_file = BufferedInputFile(qr_bio.read(), filename="vpn_qr.png")

    caption = (
        f"🎉 **Payment Successful! Your VPN is Ready.**\n\n"
        f"🏷 **Plan:** {plan['name']}\n"
        f"🌐 **Protocol:** {plan['protocol']}\n"
        f"⏳ **Duration:** {plan['duration_days']} Days\n"
        f"📊 **Traffic:** {'Unlimited' if plan['traffic_gb'] == 0 else f'{plan[\"traffic_gb\"]} GB'}\n\n"
        f"📋 **Config Link / URI:**\n`{config_string}`\n\n"
        f"Scan the QR code above in your VPN app (v2rayNG, Streisand, FoXray, V2Box, etc.) to connect!"
    )

    await callback.message.delete()
    await callback.message.answer_photo(
        photo=photo_file,
        caption=caption,
        parse_mode="Markdown",
        reply_markup=get_config_detail_keyboard(config_id)
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("pay_card_"))
async def handle_pay_card(callback: CallbackQuery, state: FSMContext):
    """User initiates payment by bank card and must upload screenshot."""
    plan_id = int(callback.data.replace("pay_card_", ""))
    plan = await db.get_plan(plan_id)
    if not plan:
        await callback.answer("Plan not found.", show_alert=True)
        return

    card_number = await db.get_setting("card_number", config.DEFAULT_CARD_NUMBER)
    card_holder = await db.get_setting("card_holder", config.DEFAULT_CARD_HOLDER)

    await state.set_state(UserOrderState.waiting_for_plan_receipt)
    await state.update_data(plan_id=plan_id, amount=plan["price"])

    text = (
        f"💳 **Bank Card Payment Details**\n\n"
        f"Please transfer the exact amount to the following card:\n\n"
        f"🔢 **Card Number:**\n`{card_number}`\n\n"
        f"👤 **Cardholder Name:**\n`{card_holder}`\n\n"
        f"💵 **Exact Amount to Pay:** `${plan['price']:.2f}`\n"
        f"🏷 **Selected Plan:** {plan['name']}\n\n"
        f"📸 **Next Step:**\n"
        f"After completing the transfer, **send a screenshot of the receipt** directly to this chat.\n"
        f"Our admins will verify it and activate your VPN immediately."
    )

    await callback.message.edit_text(text, parse_mode="Markdown")
    await callback.answer()


@user_router.message(UserOrderState.waiting_for_plan_receipt, F.photo | F.document)
async def handle_receipt_upload(message: Message, state: FSMContext, bot: Bot):
    """Handles receipt screenshot upload from user and forwards to all admins."""
    data = await state.get_data()
    plan_id = data.get("plan_id")
    amount = data.get("amount", 0.0)
    plan = await db.get_plan(plan_id)

    # Get file id
    if message.photo:
        file_id = message.photo[-1].file_id
    elif message.document:
        file_id = message.document.file_id
    else:
        await message.answer("Please send an image photo or document containing the payment receipt screenshot.")
        return

    # Create payment entry in database
    payment_id = await db.create_payment(
        user_id=message.from_user.id,
        plan_id=plan_id,
        amount=amount,
        payment_type="plan",
        screenshot_file_id=file_id
    )

    await state.clear()

    # User notification
    await message.answer(
        "✅ **Receipt Received!**\n\n"
        f"Your payment of **${amount:.2f}** for **{plan['name'] if plan else 'VPN Plan'}** "
        f"has been submitted to our team for verification.\n\n"
        "You will receive your configuration and QR code as soon as the admin approves the payment.",
        parse_mode="Markdown"
    )

    # Forward to all Admin IDs
    admin_caption = (
        f"🔔 **New Payment Receipt Pending Review!**\n\n"
        f"🆔 **Payment ID:** #{payment_id}\n"
        f"👤 **User:** {message.from_user.full_name} (@{message.from_user.username or 'NoUsername'})\n"
        f"🔢 **Telegram ID:** `{message.from_user.id}`\n"
        f"📦 **Plan:** {plan['name'] if plan else 'Unknown'}\n"
        f"💵 **Amount:** `${amount:.2f}`\n"
        f"🌐 **Protocol:** {plan['protocol'] if plan else 'Tunnel'}\n\n"
        f"Review the screenshot above and choose an action:"
    )

    for admin_id in config.ADMIN_IDS:
        try:
            if message.photo:
                await bot.send_photo(
                    chat_id=admin_id,
                    photo=file_id,
                    caption=admin_caption,
                    reply_markup=get_admin_approval_keyboard(payment_id),
                    parse_mode="Markdown"
                )
            else:
                await bot.send_document(
                    chat_id=admin_id,
                    document=file_id,
                    caption=admin_caption,
                    reply_markup=get_admin_approval_keyboard(payment_id),
                    parse_mode="Markdown"
                )
        except Exception as e:
            logger.error(f"Failed to notify admin {admin_id}: {e}")


# ----------------------------------------------------
# TOP-UP BALANCE
# ----------------------------------------------------

@user_router.callback_query(F.data == "user_topup")
async def handle_user_topup(callback: CallbackQuery, state: FSMContext):
    await state.set_state(UserOrderState.waiting_for_topup_amount)
    await callback.message.edit_text(
        "💳 **Top-up Your Account Balance**\n\n"
        "Please type the amount in USD that you wish to add (e.g. `10`, `15`, `25`):",
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.message(UserOrderState.waiting_for_topup_amount)
async def handle_topup_amount_input(message: Message, state: FSMContext):
    try:
        amount = float(message.text.replace("$", "").strip())
        if amount <= 0:
            raise ValueError()
    except ValueError:
        await message.answer("⚠️ Please enter a valid positive number, for example: `10`")
        return

    card_number = await db.get_setting("card_number", config.DEFAULT_CARD_NUMBER)
    card_holder = await db.get_setting("card_holder", config.DEFAULT_CARD_HOLDER)

    await state.set_state(UserOrderState.waiting_for_topup_receipt)
    await state.update_data(topup_amount=amount)

    text = (
        f"💳 **Top-Up Bank Card Transfer**\n\n"
        f"Transfer the exact top-up amount to the following card:\n\n"
        f"🔢 **Card Number:**\n`{card_number}`\n\n"
        f"👤 **Cardholder Name:**\n`{card_holder}`\n\n"
        f"💵 **Amount to Transfer:** `${amount:.2f}`\n\n"
        f"📸 **Send Screenshot:**\n"
        f"Please reply by sending the payment receipt screenshot to complete your top-up."
    )
    await message.answer(text, parse_mode="Markdown")


@user_router.message(UserOrderState.waiting_for_topup_receipt, F.photo | F.document)
async def handle_topup_receipt(message: Message, state: FSMContext, bot: Bot):
    data = await state.get_data()
    amount = data.get("topup_amount", 0.0)

    file_id = message.photo[-1].file_id if message.photo else message.document.file_id

    payment_id = await db.create_payment(
        user_id=message.from_user.id,
        plan_id=None,
        amount=amount,
        payment_type="topup",
        screenshot_file_id=file_id
    )

    await state.clear()
    await message.answer(
        f"✅ **Receipt Uploaded!**\n\n"
        f"Your top-up of **${amount:.2f}** is pending approval. Your balance will update automatically.",
        parse_mode="Markdown"
    )

    admin_caption = (
        f"💰 **New Balance Top-Up Pending!**\n\n"
        f"🆔 **Payment ID:** #{payment_id}\n"
        f"👤 **User:** {message.from_user.full_name} (@{message.from_user.username or 'NoUsername'})\n"
        f"🔢 **Telegram ID:** `{message.from_user.id}`\n"
        f"💵 **Top-Up Amount:** `${amount:.2f}`\n"
    )

    for admin_id in config.ADMIN_IDS:
        try:
            if message.photo:
                await bot.send_photo(
                    chat_id=admin_id,
                    photo=file_id,
                    caption=admin_caption,
                    reply_markup=get_admin_approval_keyboard(payment_id),
                    parse_mode="Markdown"
                )
            else:
                await bot.send_document(
                    chat_id=admin_id,
                    document=file_id,
                    caption=admin_caption,
                    reply_markup=get_admin_approval_keyboard(payment_id),
                    parse_mode="Markdown"
                )
        except Exception as e:
            logger.error(f"Failed to forward top-up to admin {admin_id}: {e}")


# ----------------------------------------------------
# FREE TRIAL
# ----------------------------------------------------

@user_router.callback_query(F.data == "user_trial")
async def handle_user_trial(callback: CallbackQuery):
    trial_enabled = (await db.get_setting("trial_enabled", "1")) == "1"
    if not trial_enabled:
        await callback.answer("Free trial is currently disabled by administrator.", show_alert=True)
        return

    user = await db.get_user(callback.from_user.id)
    if user and user.get("trial_claimed"):
        await callback.answer("You have already claimed your free trial test account.", show_alert=True)
        return

    trial_days = int(await db.get_setting("trial_days", "1"))
    trial_gb = int(await db.get_setting("trial_traffic_gb", "1"))
    trial_protocol = await db.get_setting("trial_protocol", "Tunnel")

    # Mark claimed
    await db.mark_trial_claimed(callback.from_user.id)

    # Provision on 3x-ui
    client_uuid = str(uuid.uuid4())
    client_email = f"trial_{callback.from_user.id}"
    inbound = await xui_client.get_suitable_inbound(trial_protocol)
    inbound_id = inbound.get("id", 1) if inbound else 1

    await xui_client.add_client(
        inbound_id=inbound_id,
        email=client_email,
        client_uuid=client_uuid,
        total_gb=trial_gb,
        expiry_days=trial_days
    )

    config_string = xui_client.build_config_string(inbound or {"port": 443, "protocol": "vless"}, client_uuid, client_email)
    total_bytes = trial_gb * 1024 * 1024 * 1024
    import time
    expiry_ms = int((time.time() + (trial_days * 86400)) * 1000)

    config_id = await db.create_user_config(
        user_id=callback.from_user.id,
        plan_id=None,
        client_uuid=client_uuid,
        inbound_id=inbound_id,
        email=client_email,
        protocol=trial_protocol,
        traffic_limit_bytes=total_bytes,
        expiry_time_ms=expiry_ms,
        config_link=config_string,
        raw_config=config_string
    )

    qr_bio = xui_client.generate_qr_bytes(config_string)
    photo_file = BufferedInputFile(qr_bio.read(), filename="trial_qr.png")

    caption = (
        f"🎁 **Free Trial Activated!**\n\n"
        f"⏳ **Duration:** {trial_days} Day(s)\n"
        f"📊 **Traffic Limit:** {trial_gb} GB\n"
        f"🌐 **Protocol:** {trial_protocol}\n\n"
        f"📋 **Config Link / URI:**\n`{config_string}`\n\n"
        f"Scan the QR code in your client to start testing!"
    )

    await callback.message.delete()
    await callback.message.answer_photo(
        photo=photo_file,
        caption=caption,
        parse_mode="Markdown",
        reply_markup=get_config_detail_keyboard(config_id)
    )
    await callback.answer()


# ----------------------------------------------------
# USER CONFIGS & DETAILS
# ----------------------------------------------------

@user_router.callback_query(F.data == "user_configs")
async def handle_user_configs(callback: CallbackQuery):
    configs = await db.get_user_configs(callback.from_user.id)
    if not configs:
        await callback.message.edit_text(
            "💼 **My VPN Configs**\n\n"
            "You do not have any active VPN configurations yet.\n"
            "Use the 'Buy VPN Plan' or 'Free Trial' button to create one!",
            reply_markup=get_main_menu(callback.from_user.id),
            parse_mode="Markdown"
        )
        await callback.answer()
        return

    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    buttons = []
    for cfg in configs:
        label = f"🔐 {cfg['protocol']} (ID #{cfg['id']}) - {cfg['email']}"
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"config_view_{cfg['id']}")])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Main Menu", callback_data="menu_main")])

    await callback.message.edit_text(
        "💼 **Your Active VPN Configurations:**\n\n"
        "Click on any configuration to view QR code, details, renew or upgrade:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("config_view_"))
async def handle_config_view(callback: CallbackQuery):
    config_id = int(callback.data.replace("config_view_", ""))
    cfg = await db.get_config_by_id(config_id)
    if not cfg:
        await callback.answer("Configuration not found.", show_alert=True)
        return

    import datetime
    expiry_str = "Never (Unlimited)" if cfg["expiry_time_ms"] == 0 else datetime.datetime.fromtimestamp(cfg["expiry_time_ms"] / 1000).strftime("%Y-%m-%d %H:%M")
    traffic_gb = round(cfg["traffic_limit_bytes"] / (1024**3), 2)
    traffic_str = "Unlimited" if cfg["traffic_limit_bytes"] == 0 else f"{traffic_gb} GB"

    text = (
        f"🔐 **VPN Configuration Details**\n\n"
        f"🆔 **Config ID:** #{cfg['id']}\n"
        f"📧 **Identifier:** `{cfg['email']}`\n"
        f"🌐 **Protocol:** {cfg['protocol']}\n"
        f"📊 **Traffic Limit:** {traffic_str}\n"
        f"⏳ **Expires:** {expiry_str}\n\n"
        f"🔗 **Config URI:**\n`{cfg['config_link']}`\n"
    )

    await callback.message.edit_text(
        text,
        reply_markup=get_config_detail_keyboard(config_id),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("config_qr_"))
async def handle_config_qr(callback: CallbackQuery):
    config_id = int(callback.data.replace("config_qr_", ""))
    cfg = await db.get_config_by_id(config_id)
    if not cfg:
        await callback.answer("Config not found.", show_alert=True)
        return

    qr_bio = xui_client.generate_qr_bytes(cfg["config_link"])
    photo_file = BufferedInputFile(qr_bio.read(), filename="vpn_qr.png")

    await callback.message.answer_photo(
        photo=photo_file,
        caption=f"📲 **Scan QR Code for Config #{cfg['id']}**\n\n`{cfg['config_link']}`",
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("config_renew_") | F.data.startswith("config_upgrade_"))
async def handle_config_extend_prompt(callback: CallbackQuery):
    config_id = int(callback.data.split("_")[-1])
    plans = await db.get_active_plans()
    
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    buttons = []
    for p in plans:
        buttons.append([InlineKeyboardButton(text=f"Add {p['name']} (+${p['price']:.2f})", callback_data=f"do_extend_{config_id}_{p['id']}")])
    buttons.append([InlineKeyboardButton(text="🔙 Back", callback_data=f"config_view_{config_id}")])

    await callback.message.edit_text(
        "🔄 **Renew / Upgrade Your VPN Config:**\n\n"
        "Select a package to extend your traffic and validity duration:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("do_extend_"))
async def handle_do_extend(callback: CallbackQuery):
    parts = callback.data.split("_")
    config_id = int(parts[2])
    plan_id = int(parts[3])
    
    cfg = await db.get_config_by_id(config_id)
    plan = await db.get_plan(plan_id)
    user = await db.get_user(callback.from_user.id)

    if not cfg or not plan or not user:
        await callback.answer("Invalid request.", show_alert=True)
        return

    if user["balance"] < plan["price"]:
        await callback.answer("Insufficient balance to renew/upgrade. Please top up first.", show_alert=True)
        return

    # Deduct balance
    await db.update_balance(callback.from_user.id, -plan["price"])

    # Update in 3x-ui
    await xui_client.extend_client(
        inbound_id=cfg["inbound_id"],
        client_uuid=cfg["client_uuid"],
        add_gb=plan["traffic_gb"],
        add_days=plan["duration_days"]
    )

    # Update in local DB
    add_bytes = plan["traffic_gb"] * 1024 * 1024 * 1024
    add_ms = plan["duration_days"] * 86400 * 1000
    await db.update_config_extension(config_id, add_bytes, add_ms)

    await callback.answer("✅ VPN Config successfully renewed and extended!", show_alert=True)
    await callback.message.edit_text(
        f"✅ **Config #{config_id} Renewed Successfully!**\n\n"
        f"Added +{plan['duration_days']} Days and +{plan['traffic_gb']} GB traffic.",
        reply_markup=get_config_detail_keyboard(config_id),
        parse_mode="Markdown"
    )


# ----------------------------------------------------
# SUPPORT TICKETS
# ----------------------------------------------------

@user_router.callback_query(F.data == "user_ticket")
async def handle_user_ticket_menu(callback: CallbackQuery):
    tickets = await db.get_user_tickets(callback.from_user.id)
    
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    buttons = [
        [InlineKeyboardButton(text="✍️ Open New Support Ticket", callback_data="ticket_create_new")]
    ]
    for t in tickets:
        status_icon = "🟢" if t["status"] == "open" else "✅"
        buttons.append([InlineKeyboardButton(text=f"{status_icon} Ticket #{t['id']}: {t['subject'][:20]}", callback_data=f"ticket_view_{t['id']}")])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Main Menu", callback_data="menu_main")])

    await callback.message.edit_text(
        "🎫 **FastVPN Support Desk**\n\n"
        "Have questions about setup, connection issues, or billing?\n"
        "Open a support ticket and our team will answer you inside the bot.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data == "ticket_create_new")
async def handle_ticket_create_new(callback: CallbackQuery, state: FSMContext):
    await state.set_state(UserOrderState.waiting_for_ticket_subject)
    await callback.message.edit_text(
        "✍️ **New Support Ticket**\n\n"
        "Please enter a short subject for your inquiry (e.g. `iOS Setup issue`, `Payment question`):",
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.message(UserOrderState.waiting_for_ticket_subject)
async def handle_ticket_subject_input(message: Message, state: FSMContext):
    await state.update_data(ticket_subject=message.text.strip())
    await state.set_state(UserOrderState.waiting_for_ticket_message)
    await message.answer(
        "📝 Now, please describe your issue or question in detail:",
        parse_mode="Markdown"
    )


@user_router.message(UserOrderState.waiting_for_ticket_message)
async def handle_ticket_message_input(message: Message, state: FSMContext, bot: Bot):
    data = await state.get_data()
    subject = data.get("ticket_subject", "Support Inquiry")
    text = message.text.strip()

    ticket_id = await db.create_ticket(
        user_id=message.from_user.id,
        user_name=message.from_user.full_name,
        subject=subject,
        message=text
    )

    await state.clear()
    await message.answer(
        f"✅ **Ticket #{ticket_id} Created Successfully!**\n\n"
        "Our support staff has been alerted and will reply shortly.",
        reply_markup=get_main_menu(message.from_user.id)
    )

    # Notify admins
    for admin_id in config.ADMIN_IDS:
        try:
            from bot.keyboards.inline import get_ticket_admin_keyboard
            await bot.send_message(
                chat_id=admin_id,
                text=(
                    f"🎫 **New Support Ticket #{ticket_id}**\n\n"
                    f"👤 User: {message.from_user.full_name} (`{message.from_user.id}`)\n"
                    f"📌 Subject: *{subject}*\n\n"
                    f"💬 Message:\n{text}"
                ),
                reply_markup=get_ticket_admin_keyboard(ticket_id),
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Failed to alert admin {admin_id} for ticket: {e}")


@user_router.callback_query(F.data.startswith("ticket_view_"))
async def handle_ticket_view(callback: CallbackQuery):
    ticket_id = int(callback.data.replace("ticket_view_", ""))
    ticket = await db.get_ticket(ticket_id)
    if not ticket:
        await callback.answer("Ticket not found.", show_alert=True)
        return

    msgs_text = ""
    for m in ticket.get("messages", []):
        sender = "👤 You" if m["sender_type"] == "user" else "🛡 Admin"
        msgs_text += f"\n**{sender}:** {m['text']}\n"

    text = (
        f"🎫 **Ticket #{ticket['id']}: {ticket['subject']}**\n"
        f"Status: **{ticket['status'].upper()}**\n"
        f"----------------------------------------"
        f"{msgs_text}"
    )

    await callback.message.edit_text(
        text,
        reply_markup=get_ticket_user_keyboard(ticket_id),
        parse_mode="Markdown"
    )
    await callback.answer()


@user_router.callback_query(F.data.startswith("ticket_reply_"))
async def handle_ticket_reply_prompt(callback: CallbackQuery, state: FSMContext):
    ticket_id = int(callback.data.replace("ticket_reply_", ""))
    await state.set_state(UserOrderState.waiting_for_ticket_reply)
    await state.update_data(active_ticket_id=ticket_id)
    await callback.message.answer(f"💬 Send your reply for Ticket #{ticket_id}:")
    await callback.answer()


@user_router.message(UserOrderState.waiting_for_ticket_reply)
async def handle_ticket_reply_message(message: Message, state: FSMContext, bot: Bot):
    data = await state.get_data()
    ticket_id = data.get("active_ticket_id")
    await db.add_ticket_message(ticket_id, "user", message.text)
    await state.clear()
    await message.answer(f"✅ Your reply was added to Ticket #{ticket_id}!")

    for admin_id in config.ADMIN_IDS:
        try:
            from bot.keyboards.inline import get_ticket_admin_keyboard
            await bot.send_message(
                chat_id=admin_id,
                text=f"💬 **User Reply on Ticket #{ticket_id}**\n\n{message.text}",
                reply_markup=get_ticket_admin_keyboard(ticket_id)
            )
        except Exception as e:
            logger.error(f"Failed to alert admin: {e}")


# ----------------------------------------------------
# SETUP GUIDE
# ----------------------------------------------------

@user_router.callback_query(F.data == "user_guide")
async def handle_user_guide(callback: CallbackQuery):
    guide_text = (
        "📖 **Client Applications & Setup Guide**\n\n"
        "To connect with your VPN configuration or QR code:\n\n"
        "🍏 **Apple iOS (iPhone / iPad):**\n"
        "• **Streisand** (Free, App Store)\n"
        "• **FoXray** (Free, App Store)\n"
        "• **V2Box** or **Shadowrocket**\n\n"
        "🤖 **Android:**\n"
        "• **v2rayNG** (Google Play Store)\n"
        "• **NekoBox** (GitHub / Play Store)\n\n"
        "💻 **Windows PC:**\n"
        "• **v2rayN** (GitHub)\n"
        "• **Nekoray** / **Clash Verge**\n\n"
        "🍎 **macOS:**\n"
        "• **FoXray** or **V2Box** (Mac App Store)\n\n"
        "Simply copy the config link or scan the QR code using the '➕' button in your app!"
    )
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Back to Main Menu", callback_data="menu_main")]
    ])
    await callback.message.edit_text(guide_text, reply_markup=markup, parse_mode="Markdown")
    await callback.answer()
