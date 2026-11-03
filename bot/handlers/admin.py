import uuid
import logging
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, BufferedInputFile
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.config import config
from bot.database.db import db
from bot.services.xui_client import xui_client
from bot.keyboards.inline import (
    get_admin_dashboard_keyboard,
    get_admin_plans_keyboard,
    get_admin_plan_actions_keyboard,
    get_config_detail_keyboard,
    get_ticket_admin_keyboard
)

logger = logging.getLogger(__name__)
admin_router = Router()


class AdminState(StatesGroup):
    waiting_for_card_number = State()
    waiting_for_card_holder = State()
    
    # Plan creation wizard
    new_plan_name = State()
    new_plan_price = State()
    new_plan_duration = State()
    new_plan_traffic = State()
    new_plan_protocol = State()

    # Plan editing
    edit_plan_name = State()
    edit_plan_price = State()
    edit_plan_limits = State()

    # User balance edit
    user_search = State()
    user_balance_delta = State()

    # Ticket reply
    ticket_reply = State()

    # Broadcast
    broadcast_message = State()

    # Trial settings
    trial_days = State()
    trial_traffic = State()


def is_admin(user_id: int) -> bool:
    return user_id in config.ADMIN_IDS


@admin_router.message(Command("admin"))
@admin_router.callback_query(F.data == "admin_dashboard")
async def handle_admin_menu(event: Message | CallbackQuery, state: FSMContext):
    """Admin dashboard landing view."""
    user_id = event.from_user.id
    if not is_admin(user_id):
        if isinstance(event, CallbackQuery):
            await event.answer("Access denied: You are not an administrator.", show_alert=True)
        else:
            await event.answer("Access denied: You are not an administrator.")
        return

    await state.clear()
    text = (
        "🛡 **FastVPN Admin Control Center**\n\n"
        "Select an administrative module to manage:"
    )
    if isinstance(event, CallbackQuery):
        await event.message.edit_text(text, reply_markup=get_admin_dashboard_keyboard(), parse_mode="Markdown")
        await event.answer()
    else:
        await event.answer(text, reply_markup=get_admin_dashboard_keyboard(), parse_mode="Markdown")


# ----------------------------------------------------
# PAYMENT APPROVAL & REJECTION
# ----------------------------------------------------

@admin_router.callback_query(F.data.startswith("admin_pay_approve_"))
async def handle_admin_pay_approve(callback: CallbackQuery, bot: Bot):
    if not is_admin(callback.from_user.id):
        await callback.answer("Unauthorized.", show_alert=True)
        return

    payment_id = int(callback.data.replace("admin_pay_approve_", ""))
    payment = await db.get_payment(payment_id)
    if not payment:
        await callback.answer("Payment record not found.", show_alert=True)
        return

    if payment["status"] != "pending":
        await callback.answer(f"Payment already marked as {payment['status'].upper()}.", show_alert=True)
        return

    user_id = payment["user_id"]
    payment_type = payment["payment_type"]
    amount = payment["amount"]

    # Process based on type
    if payment_type == "topup":
        # Add to balance
        new_balance = await db.update_balance(user_id, amount)
        await db.update_payment_status(payment_id, "approved")

        try:
            await bot.send_message(
                chat_id=user_id,
                text=(
                    f"🎉 **Top-Up Approved!**\n\n"
                    f"Your account balance has been credited with **+${amount:.2f}**.\n"
                    f"💰 **New Balance:** `${new_balance:.2f}`\n\n"
                    f"You can now purchase VPN configurations directly from your balance!"
                ),
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Failed to notify user {user_id}: {e}")

        await callback.message.edit_caption(
            caption=(callback.message.caption or "") + f"\n\n✅ **APPROVED by @{callback.from_user.username}**",
            reply_markup=None
        )
        await callback.answer("Top-up approved successfully!")

    elif payment_type == "plan":
        plan = await db.get_plan(payment["plan_id"])
        if not plan:
            await callback.answer("Associated plan no longer exists.", show_alert=True)
            return

        # Provision in 3x-ui
        client_uuid = str(uuid.uuid4())
        client_email = f"user_{user_id}_{plan['id']}"
        inbound = await xui_client.get_suitable_inbound(plan["protocol"])
        inbound_id = inbound.get("id", 1) if inbound else 1

        success, msg = await xui_client.add_client(
            inbound_id=inbound_id,
            email=client_email,
            client_uuid=client_uuid,
            total_gb=plan["traffic_gb"],
            expiry_days=plan["duration_days"]
        )

        config_string = xui_client.build_config_string(inbound or {"port": 443, "protocol": "vless"}, client_uuid, client_email)
        total_bytes = plan["traffic_gb"] * 1024 * 1024 * 1024
        import time
        expiry_ms = int((time.time() + (plan["duration_days"] * 86400)) * 1000) if plan["duration_days"] > 0 else 0

        config_id = await db.create_user_config(
            user_id=user_id,
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

        await db.update_payment_status(payment_id, "approved")

        # Send config & QR to user
        qr_bio = xui_client.generate_qr_bytes(config_string)
        photo_file = BufferedInputFile(qr_bio.read(), filename="vpn_qr.png")

        user_caption = (
            f"🎉 **Your Payment Has Been Approved!**\n\n"
            f"🏷 **Plan:** {plan['name']}\n"
            f"🌐 **Protocol:** {plan['protocol']}\n"
            f"⏳ **Duration:** {plan['duration_days']} Days\n"
            f"📊 **Traffic:** {'Unlimited' if plan['traffic_gb'] == 0 else f'{plan[\"traffic_gb\"]} GB'}\n\n"
            f"📋 **Config URI:**\n`{config_string}`\n\n"
            f"Scan the QR code above in your VPN client or tap below to manage."
        )

        try:
            await bot.send_photo(
                chat_id=user_id,
                photo=photo_file,
                caption=user_caption,
                parse_mode="Markdown",
                reply_markup=get_config_detail_keyboard(config_id)
            )
        except Exception as e:
            logger.error(f"Failed to send config to user {user_id}: {e}")

        await callback.message.edit_caption(
            caption=(callback.message.caption or "") + f"\n\n✅ **APPROVED & CONFIG CREATED by @{callback.from_user.username}**",
            reply_markup=None
        )
        await callback.answer("Plan approved and VPN configuration generated!")


@admin_router.callback_query(F.data.startswith("admin_pay_reject_"))
async def handle_admin_pay_reject(callback: CallbackQuery, bot: Bot):
    if not is_admin(callback.from_user.id):
        await callback.answer("Unauthorized.", show_alert=True)
        return

    payment_id = int(callback.data.replace("admin_pay_reject_", ""))
    payment = await db.get_payment(payment_id)
    if not payment or payment["status"] != "pending":
        await callback.answer("Payment cannot be rejected.", show_alert=True)
        return

    await db.update_payment_status(payment_id, "rejected")

    try:
        await bot.send_message(
            chat_id=payment["user_id"],
            text=(
                f"❌ **Payment Receipt Rejected**\n\n"
                f"Your payment submission #{payment_id} (${payment['amount']:.2f}) was rejected by the administrator.\n\n"
                f"If you believe this is a mistake, please open a **Support Ticket** with valid proof."
            ),
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"Failed to notify user: {e}")

    await callback.message.edit_caption(
        caption=(callback.message.caption or "") + f"\n\n❌ **REJECTED by @{callback.from_user.username}**",
        reply_markup=None
    )
    await callback.answer("Payment rejected and user notified.")


# ----------------------------------------------------
# CARD PAYMENT SETTINGS
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_card")
async def handle_admin_card(callback: CallbackQuery):
    card_num = await db.get_setting("card_number", config.DEFAULT_CARD_NUMBER)
    card_holder = await db.get_setting("card_holder", config.DEFAULT_CARD_HOLDER)

    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Edit Card Number", callback_data="admin_edit_card_num")],
        [InlineKeyboardButton(text="✏️ Edit Cardholder Name", callback_data="admin_edit_card_name")],
        [InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")]
    ])

    await callback.message.edit_text(
        f"💳 **Bank Card Payment Details (Admin)**\n\n"
        f"🔢 **Current Card Number:**\n`{card_num}`\n\n"
        f"👤 **Current Cardholder Name:**\n`{card_holder}`\n\n"
        f"Both of these are shown to users during manual checkout.",
        reply_markup=markup,
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data == "admin_edit_card_num")
async def handle_admin_edit_card_num(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AdminState.waiting_for_card_number)
    await callback.message.edit_text(
        "🔢 Please enter the new Card Number (e.g. `4400 9876 5432 1098`):"
    )
    await callback.answer()


@admin_router.message(AdminState.waiting_for_card_number)
async def handle_card_number_input(message: Message, state: FSMContext):
    new_num = message.text.strip()
    await db.set_setting("card_number", new_num)
    await state.clear()
    await message.answer(
        f"✅ Card number updated to: `{new_num}`",
        reply_markup=get_admin_dashboard_keyboard(),
        parse_mode="Markdown"
    )


@admin_router.callback_query(F.data == "admin_edit_card_name")
async def handle_admin_edit_card_name(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AdminState.waiting_for_card_holder)
    await callback.message.edit_text(
        "👤 Please enter the new Cardholder Name (e.g. `Jane Doe (FastVPN)`):"
    )
    await callback.answer()


@admin_router.message(AdminState.waiting_for_card_holder)
async def handle_card_holder_input(message: Message, state: FSMContext):
    new_name = message.text.strip()
    await db.set_setting("card_holder", new_name)
    await state.clear()
    await message.answer(
        f"✅ Cardholder name updated to: `{new_name}`",
        reply_markup=get_admin_dashboard_keyboard(),
        parse_mode="Markdown"
    )


# ----------------------------------------------------
# PLANS MANAGEMENT (CRUD)
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_plans")
async def handle_admin_plans(callback: CallbackQuery):
    plans = await db.get_all_plans()
    await callback.message.edit_text(
        "📦 **Plans Management (Admin CRUD)**\n\n"
        "Click on an existing plan to modify or click Create New Plan:",
        reply_markup=get_admin_plans_keyboard(plans),
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data == "admin_plan_new")
async def handle_admin_plan_new(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AdminState.new_plan_name)
    await callback.message.edit_text(
        "➕ **Create New VPN Plan (Step 1/5)**\n\n"
        "Enter the plan name (e.g. `VIP Tunnel 30 Days`):",
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.message(AdminState.new_plan_name)
async def handle_plan_step1(message: Message, state: FSMContext):
    await state.update_data(plan_name=message.text.strip())
    await state.set_state(AdminState.new_plan_price)
    await message.answer("💵 **Step 2/5:** Enter the price in USD (e.g. `5.50`):")


@admin_router.message(AdminState.new_plan_price)
async def handle_plan_step2(message: Message, state: FSMContext):
    try:
        price = float(message.text.replace("$", "").strip())
    except ValueError:
        await message.answer("⚠️ Please enter a valid number, e.g. `5.0`:")
        return

    await state.update_data(plan_price=price)
    await state.set_state(AdminState.new_plan_duration)
    await message.answer("⏳ **Step 3/5:** Enter the validity in days (enter `0` for traffic-only packages):")


@admin_router.message(AdminState.new_plan_duration)
async def handle_plan_step3(message: Message, state: FSMContext):
    try:
        duration = int(message.text.strip())
    except ValueError:
        await message.answer("⚠️ Please enter a whole number of days (e.g. `30` or `0`):")
        return

    await state.update_data(plan_duration=duration)
    await state.set_state(AdminState.new_plan_traffic)
    await message.answer("📊 **Step 4/5:** Enter traffic in GB (enter `0` for Unlimited):")


@admin_router.message(AdminState.new_plan_traffic)
async def handle_plan_step4(message: Message, state: FSMContext):
    try:
        traffic = int(message.text.strip())
    except ValueError:
        await message.answer("⚠️ Please enter whole GB (e.g. `100` or `0`):")
        return

    await state.update_data(plan_traffic=traffic)
    await state.set_state(AdminState.new_plan_protocol)
    await message.answer(
        "🌐 **Step 5/5:** Enter protocol type (e.g. `Tunnel (VLESS-Reality)`, `WireGuard-Tunnel`, or `Direct`):"
    )


@admin_router.message(AdminState.new_plan_protocol)
async def handle_plan_step5(message: Message, state: FSMContext):
    protocol = message.text.strip()
    data = await state.get_data()

    plan_id = await db.create_plan(
        name=data["plan_name"],
        price=data["plan_price"],
        duration_days=data["plan_duration"],
        traffic_gb=data["plan_traffic"],
        protocol=protocol
    )

    await state.clear()
    await message.answer(
        f"✅ **Plan #{plan_id} Created Successfully!**\n\n"
        f"🏷 **Name:** {data['plan_name']}\n"
        f"💵 **Price:** ${data['plan_price']:.2f}\n"
        f"⏳ **Duration:** {data['plan_duration']} Days\n"
        f"📊 **Traffic:** {data['plan_traffic']} GB\n"
        f"🌐 **Protocol:** {protocol}",
        reply_markup=get_admin_dashboard_keyboard(),
        parse_mode="Markdown"
    )


@admin_router.callback_query(F.data.startswith("admin_plan_view_"))
async def handle_admin_plan_view(callback: CallbackQuery):
    plan_id = int(callback.data.replace("admin_plan_view_", ""))
    plan = await db.get_plan(plan_id)
    if not plan:
        await callback.answer("Plan not found.", show_alert=True)
        return

    status = "Active 🟢" if plan["is_active"] else "Disabled 🔴"
    text = (
        f"📦 **Plan #{plan['id']}: {plan['name']}**\n\n"
        f"💵 **Price:** `${plan['price']:.2f}`\n"
        f"⏳ **Duration:** {plan['duration_days']} Days\n"
        f"📊 **Traffic:** {'Unlimited' if plan['traffic_gb'] == 0 else f'{plan[\"traffic_gb\"]} GB'}\n"
        f"🌐 **Protocol:** {plan['protocol']}\n"
        f"💡 **Status:** {status}\n"
    )

    await callback.message.edit_text(
        text,
        reply_markup=get_admin_plan_actions_keyboard(plan_id, bool(plan["is_active"])),
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data.startswith("admin_plan_toggle_"))
async def handle_admin_plan_toggle(callback: CallbackQuery):
    plan_id = int(callback.data.replace("admin_plan_toggle_", ""))
    plan = await db.get_plan(plan_id)
    if plan:
        new_status = 0 if plan["is_active"] else 1
        await db.update_plan(plan_id, is_active=new_status)
        await callback.answer(f"Plan is now {'enabled' if new_status else 'disabled'}.")
        # Refresh view
        plan["is_active"] = new_status
        await callback.message.edit_reply_markup(
            reply_markup=get_admin_plan_actions_keyboard(plan_id, bool(new_status))
        )


@admin_router.callback_query(F.data.startswith("admin_plan_delete_"))
async def handle_admin_plan_delete(callback: CallbackQuery):
    plan_id = int(callback.data.replace("admin_plan_delete_", ""))
    await db.delete_plan(plan_id)
    await callback.answer("Plan deleted.")
    plans = await db.get_all_plans()
    await callback.message.edit_text(
        "📦 **Plans Management (Admin CRUD)**",
        reply_markup=get_admin_plans_keyboard(plans)
    )


# ----------------------------------------------------
# PROTOCOLS MANAGEMENT
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_protocols")
async def handle_admin_protocols(callback: CallbackQuery):
    protocols = await db.get_protocols()
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    buttons = []
    for p in protocols:
        state_icon = "🟢" if p["is_enabled"] else "🔴"
        buttons.append([
            InlineKeyboardButton(text=f"{state_icon} {p['name']}", callback_data=f"toggle_proto_{p['key']}")
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")])

    await callback.message.edit_text(
        "🌐 **Protocols Management**\n\n"
        "Click any protocol to toggle its visibility for users:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data.startswith("toggle_proto_"))
async def handle_toggle_proto(callback: CallbackQuery):
    key = callback.data.replace("toggle_proto_", "")
    protocols = await db.get_protocols()
    curr = next((p for p in protocols if p["key"] == key), None)
    if curr:
        new_val = 0 if curr["is_enabled"] else 1
        await db.toggle_protocol(key, new_val)
    
    # Reload
    updated = await db.get_protocols()
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    buttons = []
    for p in updated:
        state_icon = "🟢" if p["is_enabled"] else "🔴"
        buttons.append([
            InlineKeyboardButton(text=f"{state_icon} {p['name']}", callback_data=f"toggle_proto_{p['key']}")
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")])
    await callback.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))
    await callback.answer("Protocol updated.")


# ----------------------------------------------------
# FREE TRIAL SETTINGS
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_trial_settings")
async def handle_admin_trial_settings(callback: CallbackQuery):
    enabled = (await db.get_setting("trial_enabled", "1")) == "1"
    days = await db.get_setting("trial_days", "1")
    gb = await db.get_setting("trial_traffic_gb", "1")

    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"Status: {'🟢 Enabled' if enabled else '🔴 Disabled'} (Toggle)", callback_data="admin_toggle_trial")],
        [InlineKeyboardButton(text=f"⏳ Duration: {days} Day(s) (Edit)", callback_data="admin_edit_trial_days")],
        [InlineKeyboardButton(text=f"📊 Traffic: {gb} GB (Edit)", callback_data="admin_edit_trial_gb")],
        [InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")]
    ])

    await callback.message.edit_text(
        "🎁 **Free Trial Configuration**\n\n"
        "Configure trial parameters for new users:",
        reply_markup=markup,
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data == "admin_toggle_trial")
async def handle_admin_toggle_trial(callback: CallbackQuery):
    curr = (await db.get_setting("trial_enabled", "1")) == "1"
    new_val = "0" if curr else "1"
    await db.set_setting("trial_enabled", new_val)
    await callback.answer(f"Trial is now {'enabled' if new_val == '1' else 'disabled'}.")
    await handle_admin_trial_settings(callback)


# ----------------------------------------------------
# USERS & BALANCES
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_users")
async def handle_admin_users(callback: CallbackQuery, state: FSMContext):
    users = await db.get_all_users()
    top_users = users[:15]
    
    text = f"👥 **User Management (Total: {len(users)})**\n\n"
    for u in top_users:
        text += f"• `{u['telegram_id']}` | {u['first_name']} (@{u['username'] or 'None'}) - Balance: `${u['balance']:.2f}`\n"

    text += "\nTo adjust a user's balance, click below and enter their Telegram ID:"
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💵 Adjust User Balance", callback_data="admin_user_balance_search")],
        [InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")]
    ])

    await callback.message.edit_text(text, reply_markup=markup, parse_mode="Markdown")
    await callback.answer()


@admin_router.callback_query(F.data == "admin_user_balance_search")
async def handle_admin_balance_search(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AdminState.user_search)
    await callback.message.edit_text("🔍 Enter the Telegram ID of the user to adjust balance:")
    await callback.answer()


@admin_router.message(AdminState.user_search)
async def handle_user_search_input(message: Message, state: FSMContext):
    if not message.text.strip().isdigit():
        await message.answer("Please enter a numeric Telegram ID.")
        return
    tg_id = int(message.text.strip())
    user = await db.get_user(tg_id)
    if not user:
        await message.answer("User not found in bot database.")
        await state.clear()
        return

    await state.update_data(target_user_id=tg_id)
    await state.set_state(AdminState.user_balance_delta)
    await message.answer(
        f"👤 Selected User: {user['first_name']} (`{tg_id}`)\n"
        f"Current Balance: `${user['balance']:.2f}`\n\n"
        f"Enter the amount to ADD or SUBTRACT (e.g. `+10` or `-5`):"
    )


@admin_router.message(AdminState.user_balance_delta)
async def handle_user_balance_delta(message: Message, state: FSMContext, bot: Bot):
    try:
        delta = float(message.text.strip().replace("$", ""))
    except ValueError:
        await message.answer("Invalid amount format. Example: `10` or `-5`")
        return

    data = await state.get_data()
    tg_id = data.get("target_user_id")
    new_bal = await db.update_balance(tg_id, delta)
    await state.clear()

    await message.answer(
        f"✅ Balance updated successfully!\nUser `{tg_id}` new balance: `${new_bal:.2f}`",
        reply_markup=get_admin_dashboard_keyboard()
    )

    try:
        await bot.send_message(
            chat_id=tg_id,
            text=f"ℹ️ **Admin Adjustment:** Your balance has been updated by {delta:+.2f}$. Current balance: `${new_bal:.2f}`",
            parse_mode="Markdown"
        )
    except Exception:
        pass


# ----------------------------------------------------
# STATISTICS
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_stats")
async def handle_admin_stats(callback: CallbackQuery):
    stats = await db.get_statistics()
    text = (
        "📊 **VPN Bot Performance & Sales Statistics**\n\n"
        f"👥 **Total Registered Users:** `{stats['total_users']}`\n"
        f"💰 **Total Sales Volume:** `${stats['total_sales_volume']:.2f}`\n"
        f"🛒 **Total Orders Approved:** `{stats['total_sales_count']}`\n"
        f"🔐 **Active VPN Configurations:** `{stats['active_configs']}`\n"
        f"⏳ **Pending Receipts:** `{stats['pending_payments']}`\n"
        f"🎫 **Open Support Tickets:** `{stats['open_tickets']}`\n"
    )
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Refresh", callback_data="admin_stats")],
        [InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")]
    ])
    await callback.message.edit_text(text, reply_markup=markup, parse_mode="Markdown")
    await callback.answer()


# ----------------------------------------------------
# 3X-UI STATUS
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_xui_status")
async def handle_admin_xui_status(callback: CallbackQuery):
    await callback.answer("Querying 3x-ui panel...")
    inbounds = await xui_client.get_inbounds()
    
    status_emoji = "🟢 Connected" if inbounds else "🔴 Connection Failed / Unreachable"
    inbound_summary = ""
    for ib in inbounds[:5]:
        inbound_summary += f"• **#{ib.get('id')}** {ib.get('remark', 'Inbound')} | {ib.get('protocol')} (Port: {ib.get('port')})\n"

    text = (
        "🔌 **3x-UI Panel Integration Status**\n\n"
        f"🌐 **Panel URL:** `{xui_client.raw_base_url}`\n"
        f"📡 **Status:** {status_emoji}\n"
        f"📥 **Total Inbounds Detected:** `{len(inbounds)}`\n\n"
        f"**Active Inbounds:**\n{inbound_summary or 'No inbounds found.'}"
    )
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Re-check Connection", callback_data="admin_xui_status")],
        [InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")]
    ])
    await callback.message.edit_text(text, reply_markup=markup, parse_mode="Markdown")


# ----------------------------------------------------
# BROADCAST
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_broadcast")
async def handle_admin_broadcast(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AdminState.broadcast_message)
    await callback.message.edit_text(
        "📢 **Broadcast Announcement**\n\n"
        "Send the message you want to broadcast to all registered users (Markdown supported):"
    )
    await callback.answer()


@admin_router.message(AdminState.broadcast_message)
async def handle_broadcast_dispatch(message: Message, state: FSMContext, bot: Bot):
    text = message.text
    users = await db.get_all_users()
    await state.clear()

    status_msg = await message.answer(f"🚀 Broadcasting message to {len(users)} users...")
    success = 0
    failed = 0

    for u in users:
        try:
            await bot.send_message(chat_id=u["telegram_id"], text=text, parse_mode="Markdown")
            success += 1
        except Exception:
            failed += 1

    await status_msg.edit_text(
        f"📢 **Broadcast Completed!**\n\n"
        f"✅ Delivered: `{success}`\n"
        f"❌ Failed: `{failed}`\n",
        reply_markup=get_admin_dashboard_keyboard()
    )


# ----------------------------------------------------
# SUPPORT TICKETS (ADMIN VIEW)
# ----------------------------------------------------

@admin_router.callback_query(F.data == "admin_tickets")
async def handle_admin_tickets(callback: CallbackQuery):
    tickets = await db.get_tickets("open")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    buttons = []
    for t in tickets[:10]:
        buttons.append([
            InlineKeyboardButton(text=f"🎫 #{t['id']} by {t['user_name']}: {t['subject'][:15]}", callback_data=f"admin_ticket_inspect_{t['id']}")
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")])

    await callback.message.edit_text(
        f"🎫 **Open Support Tickets ({len(tickets)})**\n\n"
        "Select a ticket to read and reply:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data.startswith("admin_ticket_inspect_"))
async def handle_admin_ticket_inspect(callback: CallbackQuery):
    ticket_id = int(callback.data.replace("admin_ticket_inspect_", ""))
    ticket = await db.get_ticket(ticket_id)
    if not ticket:
        await callback.answer("Ticket not found.", show_alert=True)
        return

    msgs_text = ""
    for m in ticket.get("messages", []):
        sender = f"👤 User ({ticket['user_name']})" if m["sender_type"] == "user" else "🛡 Admin"
        msgs_text += f"\n**{sender}:** {m['text']}\n"

    text = (
        f"🎫 **Ticket #{ticket['id']} (User ID: `{ticket['user_id']}`)**\n"
        f"📌 Subject: *{ticket['subject']}*\n"
        f"Status: **{ticket['status'].upper()}**\n"
        f"----------------------------------------"
        f"{msgs_text}"
    )

    await callback.message.edit_text(
        text,
        reply_markup=get_ticket_admin_keyboard(ticket_id),
        parse_mode="Markdown"
    )
    await callback.answer()


@admin_router.callback_query(F.data.startswith("admin_ticket_reply_"))
async def handle_admin_ticket_reply_prompt(callback: CallbackQuery, state: FSMContext):
    ticket_id = int(callback.data.replace("admin_ticket_reply_", ""))
    await state.set_state(AdminState.ticket_reply)
    await state.update_data(reply_ticket_id=ticket_id)
    await callback.message.answer(f"✉️ Enter your reply to user for Ticket #{ticket_id}:")
    await callback.answer()


@admin_router.message(AdminState.ticket_reply)
async def handle_admin_ticket_reply_send(message: Message, state: FSMContext, bot: Bot):
    data = await state.get_data()
    ticket_id = data.get("reply_ticket_id")
    ticket = await db.get_ticket(ticket_id)

    if ticket:
        await db.add_ticket_message(ticket_id, "admin", message.text)
        try:
            await bot.send_message(
                chat_id=ticket["user_id"],
                text=(
                    f"💬 **Support Team Replied to Ticket #{ticket_id}**\n\n"
                    f"{message.text}"
                ),
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Failed to deliver ticket reply to user: {e}")

    await state.clear()
    await message.answer(f"✅ Reply dispatched to user for Ticket #{ticket_id}!", reply_markup=get_admin_dashboard_keyboard())


@admin_router.callback_query(F.data.startswith("admin_ticket_close_"))
async def handle_admin_ticket_close(callback: CallbackQuery):
    ticket_id = int(callback.data.replace("admin_ticket_close_", ""))
    await db.close_ticket(ticket_id)
    await callback.answer("Ticket closed.")
    await handle_admin_tickets(callback)
