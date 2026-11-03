from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from typing import List, Dict, Any, Optional
from bot.config import config


def get_main_menu(telegram_id: int, user_balance: float = 0.0) -> InlineKeyboardMarkup:
    """Main dashboard keyboard for users in English."""
    keyboard = [
        [
            InlineKeyboardButton(text="🛒 Buy VPN Plan", callback_data="user_buy"),
            InlineKeyboardButton(text="💼 My Configs", callback_data="user_configs"),
        ],
        [
            InlineKeyboardButton(text="🎁 Free Trial", callback_data="user_trial"),
            InlineKeyboardButton(text=f"💳 Top-up (${user_balance:.2f})", callback_data="user_topup"),
        ],
        [
            InlineKeyboardButton(text="🎫 Support Ticket", callback_data="user_ticket"),
            InlineKeyboardButton(text="📖 Apps & Setup Guide", callback_data="user_guide"),
        ]
    ]
    if telegram_id in config.ADMIN_IDS:
        keyboard.append([
            InlineKeyboardButton(text="🛡 Admin Control Panel", callback_data="admin_dashboard")
        ])
    return InlineKeyboardMarkup(inline_keyboard=keyboard)


def get_protocols_keyboard(protocols: List[Dict[str, Any]]) -> InlineKeyboardMarkup:
    """Protocol selector keyboard."""
    buttons = []
    for proto in protocols:
        if proto.get("is_enabled", 1):
            key = proto.get("key")
            name = proto.get("name")
            buttons.append([InlineKeyboardButton(text=f"🌐 {name}", callback_data=f"proto_select_{key}")])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Main Menu", callback_data="menu_main")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_plans_keyboard(plans: List[Dict[str, Any]]) -> InlineKeyboardMarkup:
    """List plans matching selected protocol or all plans."""
    buttons = []
    for plan in plans:
        traffic_str = "Unlimited" if plan["traffic_gb"] == 0 else f"{plan['traffic_gb']} GB"
        duration_str = "Traffic Only" if plan["duration_days"] == 0 else f"{plan['duration_days']} Days"
        title = f"{plan['name']} | ${plan['price']:.2f} ({traffic_str} / {duration_str})"
        buttons.append([InlineKeyboardButton(text=title, callback_data=f"plan_choose_{plan['id']}")])
    buttons.append([InlineKeyboardButton(text="🔙 Back", callback_data="user_buy")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_payment_methods_keyboard(plan_id: int, price: float, user_balance: float) -> InlineKeyboardMarkup:
    """Payment selection: Card with receipt upload or direct Balance deduction."""
    buttons = [
        [InlineKeyboardButton(text="💳 Pay with Bank Card (Send Receipt)", callback_data=f"pay_card_{plan_id}")],
    ]
    if user_balance >= price:
        buttons.append([
            InlineKeyboardButton(text=f"💰 Pay from Balance (${user_balance:.2f})", callback_data=f"pay_balance_{plan_id}")
        ])
    else:
        buttons.append([
            InlineKeyboardButton(text=f"💰 Insufficient Balance (${user_balance:.2f})", callback_data="user_topup")
        ])
    buttons.append([InlineKeyboardButton(text="🔙 Cancel", callback_data="user_buy")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_admin_approval_keyboard(payment_id: int) -> InlineKeyboardMarkup:
    """Admin interactive buttons to approve or reject receipt."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Approve Payment", callback_data=f"admin_pay_approve_{payment_id}"),
            InlineKeyboardButton(text="❌ Reject Payment", callback_data=f"admin_pay_reject_{payment_id}")
        ]
    ])


def get_config_detail_keyboard(config_id: int) -> InlineKeyboardMarkup:
    """Options for an active user config."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📲 Show QR Code", callback_data=f"config_qr_{config_id}"),
            InlineKeyboardButton(text="📋 Copy Link & Raw", callback_data=f"config_raw_{config_id}"),
        ],
        [
            InlineKeyboardButton(text="🔄 Renew Config", callback_data=f"config_renew_{config_id}"),
            InlineKeyboardButton(text="⚡ Upgrade Traffic", callback_data=f"config_upgrade_{config_id}"),
        ],
        [
            InlineKeyboardButton(text="🔙 Back to Configs", callback_data="user_configs")
        ]
    ])


def get_admin_dashboard_keyboard() -> InlineKeyboardMarkup:
    """Full Admin Dashboard menu."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📦 Plans Management", callback_data="admin_plans"),
            InlineKeyboardButton(text="💳 Card & Payment Settings", callback_data="admin_card"),
        ],
        [
            InlineKeyboardButton(text="👥 Users & Balances", callback_data="admin_users"),
            InlineKeyboardButton(text="📊 Sales & Statistics", callback_data="admin_stats"),
        ],
        [
            InlineKeyboardButton(text="🌐 Protocols Toggle", callback_data="admin_protocols"),
            InlineKeyboardButton(text="🎁 Free Trial Settings", callback_data="admin_trial_settings"),
        ],
        [
            InlineKeyboardButton(text="🎫 Support Tickets", callback_data="admin_tickets"),
            InlineKeyboardButton(text="📢 Broadcast Message", callback_data="admin_broadcast"),
        ],
        [
            InlineKeyboardButton(text="🔌 3x-UI Panel Status", callback_data="admin_xui_status"),
            InlineKeyboardButton(text="🔙 Back to User Mode", callback_data="menu_main"),
        ]
    ])


def get_admin_plans_keyboard(plans: List[Dict[str, Any]]) -> InlineKeyboardMarkup:
    """List of all plans with Edit / Toggle / Add buttons."""
    buttons = []
    for p in plans:
        status_icon = "🟢" if p["is_active"] else "🔴"
        text = f"{status_icon} {p['name']} - ${p['price']:.2f} ({p['protocol'][:10]})"
        buttons.append([InlineKeyboardButton(text=text, callback_data=f"admin_plan_view_{p['id']}")])
    buttons.append([InlineKeyboardButton(text="➕ Create New Plan", callback_data="admin_plan_new")])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Admin", callback_data="admin_dashboard")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_admin_plan_actions_keyboard(plan_id: int, is_active: bool) -> InlineKeyboardMarkup:
    """Actions for a specific plan."""
    toggle_text = "🔴 Disable Plan" if is_active else "🟢 Enable Plan"
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=toggle_text, callback_data=f"admin_plan_toggle_{plan_id}"),
            InlineKeyboardButton(text="✏️ Edit Name", callback_data=f"admin_plan_editname_{plan_id}"),
        ],
        [
            InlineKeyboardButton(text="💵 Edit Price", callback_data=f"admin_plan_editprice_{plan_id}"),
            InlineKeyboardButton(text="⏳ Edit Duration/Traffic", callback_data=f"admin_plan_editlimits_{plan_id}"),
        ],
        [
            InlineKeyboardButton(text="🗑 Delete Plan", callback_data=f"admin_plan_delete_{plan_id}"),
            InlineKeyboardButton(text="🔙 Back to Plans", callback_data="admin_plans"),
        ]
    ])


def get_ticket_user_keyboard(ticket_id: int) -> InlineKeyboardMarkup:
    """Ticket interaction keyboard."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="💬 Add Message", callback_data=f"ticket_reply_{ticket_id}"),
            InlineKeyboardButton(text="✅ Mark Resolved", callback_data=f"ticket_close_{ticket_id}"),
        ],
        [
            InlineKeyboardButton(text="🔙 Back", callback_data="user_ticket")
        ]
    ])


def get_ticket_admin_keyboard(ticket_id: int) -> InlineKeyboardMarkup:
    """Admin ticket interaction keyboard."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✉️ Reply to User", callback_data=f"admin_ticket_reply_{ticket_id}"),
            InlineKeyboardButton(text="🔒 Close Ticket", callback_data=f"admin_ticket_close_{ticket_id}"),
        ],
        [
            InlineKeyboardButton(text="🔙 Tickets List", callback_data="admin_tickets")
        ]
    ])
