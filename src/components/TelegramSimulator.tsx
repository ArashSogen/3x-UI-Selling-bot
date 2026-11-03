import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Send, 
  Paperclip, 
  Check, 
  CheckCheck, 
  Shield, 
  User, 
  QrCode, 
  Copy, 
  ExternalLink, 
  Sparkles, 
  Clock, 
  Database,
  Upload,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  DollarSign,
  Ticket,
  ChevronRight
} from 'lucide-react';
import { 
  TelegramUser, 
  Plan, 
  ProtocolItem, 
  PaymentRecord, 
  VpnConfigItem, 
  SupportTicket, 
  TelegramMessage 
} from '../types';
import { SAMPLE_RECEIPT_PRESETS } from '../data/initialData';
import { buildVlessRealityUri, buildWireguardConfig } from '../logic/vpn';

interface TelegramSimulatorProps {
  users: TelegramUser[];
  plans: Plan[];
  protocols: ProtocolItem[];
  payments: PaymentRecord[];
  configs: VpnConfigItem[];
  tickets: SupportTicket[];
  cardNumber: string;
  cardHolder: string;
  trialSettings: { enabled: boolean; days: number; trafficGb: number; protocol: string };
  onApprovePayment: (paymentId: number) => void;
  onRejectPayment: (paymentId: number) => void;
  onSubmitReceipt: (planId: number | undefined, amount: number, type: 'plan' | 'topup', screenshotUrl: string) => void;
  onClaimTrial: (userId: number) => void;
  onCreateTicket: (userId: number, subject: string, message: string) => void;
  onReplyTicket: (ticketId: number, sender: 'user' | 'admin', text: string) => void;
  onUpdateBalance: (userId: number, delta: number) => void;
  onTogglePlan: (planId: number) => void;
  onUpdateCardSettings: (cardNumber: string, cardHolder: string) => void;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  users,
  plans,
  protocols,
  payments,
  configs,
  tickets,
  cardNumber,
  cardHolder,
  trialSettings,
  onApprovePayment,
  onRejectPayment,
  onSubmitReceipt,
  onClaimTrial,
  onCreateTicket,
  onReplyTicket,
  onUpdateBalance,
  onTogglePlan,
  onUpdateCardSettings
}) => {
  // Perspective: 'customer' or 'admin'
  const [perspective, setPerspective] = useState<'customer' | 'admin'>('customer');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [selectedReceiptPreset, setSelectedReceiptPreset] = useState(SAMPLE_RECEIPT_PRESETS[0]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [pendingOrderDetails, setPendingOrderDetails] = useState<{ planId?: number; amount: number; type: 'plan' | 'topup'; planName?: string } | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<{ title: string; qrUrl: string; rawText: string } | null>(null);
  const [ticketSubjectModal, setTicketSubjectModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = users.find(u => (perspective === 'customer' ? !u.isAdmin : u.isAdmin)) || users[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, perspective]);

  // Initial greeting if empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg-init',
          sender: 'bot',
          chatType: 'user_bot',
          text: `👋 Welcome to **FastVPN Services**, Alex!\n\n🔒 Ultra-fast, secure, and uncensored internet connection.\n⚡ Supported Protocols: Tunnel (VLESS-Reality), WireGuard-Tunnel, and Direct.\n\n💰 **Your Balance:** $${currentUser.balance.toFixed(2)}\n\nChoose an option from the menu below to get started:`,
          timestamp: 'Just now',
          inlineButtons: [
            [
              { text: '🛒 Buy VPN Plan', action: 'user_buy' },
              { text: '💼 My Configs', action: 'user_configs' }
            ],
            [
              { text: '🎁 Free Trial (24h)', action: 'user_trial' },
              { text: `💳 Top-up ($${currentUser.balance.toFixed(2)})`, action: 'user_topup' }
            ],
            [
              { text: '🎫 Support Ticket', action: 'user_ticket' },
              { text: '📖 Apps Guide', action: 'user_guide' }
            ],
            [
              { text: '🛡 Admin Control Panel', action: 'admin_dashboard' }
            ]
          ]
        }
      ]);
    }
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const addBotMessage = (text: string, inlineButtons?: any, qrData?: string) => {
    const newMsg: TelegramMessage = {
      id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: 'bot',
      chatType: perspective === 'customer' ? 'user_bot' : 'admin_channel',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      inlineButtons,
      qrData
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const addUserMessage = (text: string) => {
    const newMsg: TelegramMessage = {
      id: `user-${Date.now()}`,
      sender: perspective === 'customer' ? 'user' : 'admin',
      chatType: perspective === 'customer' ? 'user_bot' : 'admin_channel',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
  };

  // Handle user typing commands or messages
  const handleSendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    addUserMessage(text);

    if (text === '/start') {
      setTimeout(() => {
        addBotMessage(
          `👋 Welcome back to **FastVPN Services**, ${currentUser.firstName}!\n\n💰 **Your Balance:** $${currentUser.balance.toFixed(2)}\n\nSelect an option below:`,
          [
            [
              { text: '🛒 Buy VPN Plan', action: 'user_buy' },
              { text: '💼 My Configs', action: 'user_configs' }
            ],
            [
              { text: '🎁 Free Trial (24h)', action: 'user_trial' },
              { text: `💳 Top-up ($${currentUser.balance.toFixed(2)})`, action: 'user_topup' }
            ],
            [
              { text: '🎫 Support Ticket', action: 'user_ticket' },
              { text: '📖 Apps Guide', action: 'user_guide' }
            ],
            [
              { text: '🛡 Admin Control Panel', action: 'admin_dashboard' }
            ]
          ]
        );
      }, 400);
    } else if (text === '/admin') {
      setTimeout(() => {
        handleAdminMenu();
      }, 400);
    } else {
      setTimeout(() => {
        addBotMessage(
          `🤖 Received: "${text}".\nPlease use the interactive inline menu buttons below to manage your VPN service.`,
          [
            [{ text: '🔙 Open Main Menu', action: 'menu_main' }]
          ]
        );
      }, 500);
    }
  };

  // Button Action Dispatcher
  const handleInlineAction = async (action: string) => {
    if (action === 'menu_main') {
      addBotMessage(
        `👋 **FastVPN Main Dashboard**\n\n💰 **Your Balance:** $${currentUser.balance.toFixed(2)}\n\nChoose an action:`,
        [
          [
            { text: '🛒 Buy VPN Plan', action: 'user_buy' },
            { text: '💼 My Configs', action: 'user_configs' }
          ],
          [
            { text: '🎁 Free Trial', action: 'user_trial' },
            { text: `💳 Top-up ($${currentUser.balance.toFixed(2)})`, action: 'user_topup' }
          ],
          [
            { text: '🎫 Support Ticket', action: 'user_ticket' },
            { text: '📖 Apps Guide', action: 'user_guide' }
          ],
          [
            { text: '🛡 Admin Control Panel', action: 'admin_dashboard' }
          ]
        ]
      );
    } else if (action === 'user_buy') {
      const protoButtons = protocols
        .filter(p => p.isEnabled)
        .map(p => ([{ text: `🌐 ${p.name}`, action: `proto_select_${p.key}` }]));
      protoButtons.push([{ text: '🔙 Back to Menu', action: 'menu_main' }]);

      addBotMessage(
        `🌐 **Select Your Preferred Protocol / Location:**\n\n• **Tunnel (VLESS-Reality):** Ultimate anti-filtering & censorship resistance.\n• **WireGuard-Tunnel:** Ultra-fast speeds for gaming & streaming.\n• **Direct:** High bandwidth direct routes for unrestricted networks.\n\nChoose one to view available packages:`,
        protoButtons
      );
    } else if (action.startsWith('proto_select_')) {
      const protoKey = action.replace('proto_select_', '');
      const filteredPlans = plans.filter(p => p.isActive && p.protocol.toLowerCase().includes(protoKey));
      const planButtons = (filteredPlans.length > 0 ? filteredPlans : plans.filter(p => p.isActive)).map(p => ([{
        text: `${p.name} | $${p.price.toFixed(2)} (${p.trafficGb === 0 ? 'Unlimited' : p.trafficGb + ' GB'} / ${p.durationDays === 0 ? 'Traffic Only' : p.durationDays + ' Days'})`,
        action: `plan_choose_${p.id}`
      }]));
      planButtons.push([{ text: '🔙 Choose Another Protocol', action: 'user_buy' }]);

      addBotMessage(
        `📦 **Choose Your VPN Plan:**\n\nSelect the package that fits your needs:`,
        planButtons
      );
    } else if (action.startsWith('plan_choose_')) {
      const planId = parseInt(action.replace('plan_choose_', ''), 10);
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      const trafficStr = plan.trafficGb === 0 ? 'Unlimited Traffic' : `${plan.trafficGb} GB Traffic`;
      const durationStr = plan.durationDays === 0 ? 'No Time Limit' : `${plan.durationDays} Days`;

      const paymentButtons = [
        [{ text: '💳 Pay with Bank Card (Upload Receipt)', action: `pay_card_${plan.id}` }]
      ];
      if (currentUser.balance >= plan.price) {
        paymentButtons.push([{ text: `💰 Pay from Balance ($${currentUser.balance.toFixed(2)})`, action: `pay_balance_${plan.id}` }]);
      } else {
        paymentButtons.push([{ text: `💰 Balance Insufficient ($${currentUser.balance.toFixed(2)}) - Top up`, action: 'user_topup' }]);
      }
      paymentButtons.push([{ text: '🔙 Cancel', action: 'user_buy' }]);

      addBotMessage(
        `🛒 **Plan Summary:**\n\n🏷 **Name:** ${plan.name}\n🌐 **Protocol:** ${plan.protocol}\n📊 **Traffic:** ${trafficStr}\n⏳ **Duration:** ${durationStr}\n💵 **Price:** $${plan.price.toFixed(2)}\n\n💰 **Your Balance:** $${currentUser.balance.toFixed(2)}\n\nSelect your payment method below:`,
        paymentButtons
      );
    } else if (action.startsWith('pay_balance_')) {
      const planId = parseInt(action.replace('pay_balance_', ''), 10);
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      if (currentUser.balance < plan.price) {
        addBotMessage(`⚠️ Insufficient balance ($${currentUser.balance.toFixed(2)}). Please top up or pay by card.`);
        return;
      }

      // Deduct balance
      onUpdateBalance(currentUser.id, -plan.price);

      // Create config
      const mockUuid = '7f8a9b1c-' + Math.random().toString(36).substring(2, 6) + '-4a1b-8c2d-9e0f1a2b3c4d';
      const remark = `FastVPN-${currentUser.firstName}-${plan.name.replace(/\s+/g, '')}`;
      let configUri = '';
      if (plan.protocol.includes('WireGuard')) {
        configUri = buildWireguardConfig({
          clientPrivateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890=',
          clientAddress: '10.0.0.5/32',
          serverPublicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
          endpoint: 'vpn.fastpanel.net:51820'
        });
      } else {
        configUri = buildVlessRealityUri({
          uuid: mockUuid,
          host: 'vpn.fastpanel.net',
          port: 443,
          publicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
          sni: 'zoom.us',
          shortId: '16a8c4f9',
          remark
        });
      }

      // Generate QR
      const qrDataUrl = await QRCode.toDataURL(configUri, { margin: 2, scale: 6 });

      addBotMessage(
        `🎉 **Payment Successful! Your VPN is Ready.**\n\n🏷 **Plan:** ${plan.name}\n🌐 **Protocol:** ${plan.protocol}\n⏳ **Duration:** ${plan.durationDays} Days\n📊 **Traffic:** ${plan.trafficGb === 0 ? 'Unlimited' : plan.trafficGb + ' GB'}\n\n📋 **Config URI / Profile:**\n\`${configUri.slice(0, 80)}...\`\n\n(See scanable QR code attached below)`,
        [
          [
            { text: '📲 View Full QR Code', action: `show_qr_modal_${plan.id}` },
            { text: '📋 Copy Full Config', action: `copy_config_${plan.id}` }
          ],
          [{ text: '💼 View in My Configs', action: 'user_configs' }]
        ],
        qrDataUrl
      );
    } else if (action.startsWith('pay_card_')) {
      const planId = parseInt(action.replace('pay_card_', ''), 10);
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      setPendingOrderDetails({
        planId: plan.id,
        amount: plan.price,
        type: 'plan',
        planName: plan.name
      });

      addBotMessage(
        `💳 **Bank Card Payment Details**\n\nPlease transfer the exact amount to the merchant card below:\n\n🔢 **Card Number:**\n\`${cardNumber}\`\n\n👤 **Cardholder Name:**\n\`${cardHolder}\`\n\n💵 **Exact Amount to Pay:** $${plan.price.toFixed(2)}\n🏷 **Plan:** ${plan.name}\n\n📸 **Next Step:**\nAfter completing the transfer, click **"Upload Receipt Screenshot"** below to submit proof to our admins.`,
        [
          [{ text: '📸 Upload Receipt Screenshot', action: 'open_receipt_modal' }],
          [{ text: '🔙 Cancel', action: 'user_buy' }]
        ]
      );
    } else if (action === 'open_receipt_modal') {
      setIsReceiptModalOpen(true);
    } else if (action === 'user_topup') {
      setPendingOrderDetails({
        amount: 15.0,
        type: 'topup',
        planName: 'Balance Top-Up'
      });
      addBotMessage(
        `💳 **Top-Up Balance with Bank Card**\n\nTransfer the amount you want to top up (e.g. $15.00) to our card:\n\n🔢 **Card Number:**\n\`${cardNumber}\`\n\n👤 **Cardholder Name:**\n\`${cardHolder}\`\n\n📸 Click **"Upload Receipt Screenshot"** to submit receipt for admin approval:`,
        [
          [{ text: '📸 Upload Receipt Screenshot ($15.00)', action: 'open_receipt_modal' }],
          [{ text: '🔙 Back to Menu', action: 'menu_main' }]
        ]
      );
    } else if (action === 'user_trial') {
      if (currentUser.trialClaimed) {
        addBotMessage(`⚠️ You have already claimed your free trial test account. Please browse our affordable plans.`);
        return;
      }
      onClaimTrial(currentUser.id);
      const trialUri = buildVlessRealityUri({
        uuid: 'trial-7788-9900-1122-334455667788',
        host: 'vpn.fastpanel.net',
        port: 443,
        publicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
        sni: 'zoom.us',
        shortId: '16a8c4f9',
        remark: 'FastVPN-FreeTrial-24h'
      });
      const qrDataUrl = await QRCode.toDataURL(trialUri, { margin: 2, scale: 6 });

      addBotMessage(
        `🎁 **Free Trial Activated!**\n\n⏳ **Duration:** ${trialSettings.days} Day(s)\n📊 **Traffic Limit:** ${trialSettings.trafficGb} GB\n🌐 **Protocol:** ${trialSettings.protocol}\n\n📋 **Config URI:**\n\`${trialUri}\`\n\nScan the QR code below in your VPN app (Streisand, v2rayNG, FoXray, V2Box) to connect!`,
        [
          [{ text: '💼 View in My Configs', action: 'user_configs' }]
        ],
        qrDataUrl
      );
    } else if (action === 'user_configs') {
      const userCfgs = configs.filter(c => c.userId === currentUser.id);
      if (userCfgs.length === 0) {
        addBotMessage(
          `💼 **My VPN Configs**\n\nYou don't have any active configs yet. Click "Buy VPN Plan" or "Free Trial" to get started!`,
          [
            [{ text: '🛒 Buy VPN Plan', action: 'user_buy' }],
            [{ text: '🎁 Free Trial', action: 'user_trial' }]
          ]
        );
      } else {
        const buttons = userCfgs.map(c => ([{
          text: `🔐 ${c.protocol} (#${c.id}) - ${c.email}`,
          action: `view_cfg_${c.id}`
        }]));
        buttons.push([{ text: '🔙 Main Menu', action: 'menu_main' }]);
        addBotMessage(`💼 **Your Active VPN Configurations:**\n\nClick on any service to view QR code, renew or upgrade:`, buttons);
      }
    } else if (action.startsWith('view_cfg_')) {
      const cfgId = parseInt(action.replace('view_cfg_', ''), 10);
      const cfg = configs.find(c => c.id === cfgId);
      if (!cfg) return;

      const qrDataUrl = await QRCode.toDataURL(cfg.configLink, { margin: 2, scale: 6 });

      addBotMessage(
        `🔐 **Configuration Details (#${cfg.id})**\n\n📧 **Identifier:** \`${cfg.email}\`\n🌐 **Protocol:** ${cfg.protocol}\n📊 **Traffic Limit:** ${cfg.trafficLimitBytes === 0 ? 'Unlimited' : (cfg.trafficLimitBytes / 1073741824) + ' GB'}\n⏳ **Status:** ${cfg.isActive ? 'Active 🟢' : 'Disabled 🔴'}\n\n🔗 **Config Link:**\n\`${cfg.configLink}\``,
        [
          [
            { text: '📲 Show Large QR', action: `modal_qr_${cfg.id}` },
            { text: '🔄 Renew (+30d)', action: `renew_cfg_${cfg.id}` }
          ],
          [{ text: '🔙 Back to Configs', action: 'user_configs' }]
        ],
        qrDataUrl
      );
    } else if (action.startsWith('renew_cfg_')) {
      const cfgId = parseInt(action.replace('renew_cfg_', ''), 10);
      addBotMessage(`✅ Config #${cfgId} renewal request received! Time and traffic extended.`);
    } else if (action === 'user_ticket') {
      setTicketSubjectModal(true);
    } else if (action === 'user_guide') {
      addBotMessage(
        `📖 **Recommended VPN Apps by Platform**\n\n🍏 **Apple iOS (iPhone/iPad):**\n• **Streisand** (Free, App Store)\n• **FoXray** (Free, App Store)\n• **V2Box** or **Shadowrocket**\n\n🤖 **Android:**\n• **v2rayNG** (Google Play Store)\n• **NekoBox**\n\n💻 **Windows PC:**\n• **v2rayN** or **Nekoray**\n\n🍎 **macOS:**\n• **FoXray** or **V2Box**\n\nSimply import via clipboard or scan the QR code!`,
        [
          [{ text: '🔙 Back to Menu', action: 'menu_main' }]
        ]
      );
    } else if (action === 'admin_dashboard') {
      handleAdminMenu();
    } else if (action === 'admin_plans_mgmt') {
      const planButtons = plans.map(p => ([{
        text: `${p.isActive ? '🟢' : '🔴'} ${p.name} ($${p.price})`,
        action: `admin_toggle_plan_${p.id}`
      }]));
      planButtons.push([{ text: '🔙 Back to Admin', action: 'admin_dashboard' }]);
      addBotMessage(`📦 **Plans Management (Admin CRUD)**\n\nClick any plan to toggle Active/Disabled state:`, planButtons);
    } else if (action.startsWith('admin_toggle_plan_')) {
      const planId = parseInt(action.replace('admin_toggle_plan_', ''), 10);
      onTogglePlan(planId);
      addBotMessage(`⚙️ Toggled status for Plan #${planId}!`);
    } else if (action === 'admin_card_settings') {
      addBotMessage(
        `💳 **Card Payment Details (Admin Editor)**\n\n🔢 **Current Card Number:**\n\`${cardNumber}\`\n\n👤 **Cardholder Name:**\n\`${cardHolder}\`\n\n(You can edit these dynamically in the Settings tab above!)`,
        [
          [{ text: '🔙 Back to Admin', action: 'admin_dashboard' }]
        ]
      );
    } else if (action === 'admin_stats') {
      const approvedTotal = payments.filter(p => p.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0);
      addBotMessage(
        `📊 **Bot Performance & Sales Statistics**\n\n👥 **Total Users:** ${users.length}\n💰 **Total Approved Sales:** $${approvedTotal.toFixed(2)}\n🔐 **Active VPN Configs:** ${configs.length}\n⏳ **Pending Receipts:** ${payments.filter(p => p.status === 'pending').length}\n🎫 **Open Support Tickets:** ${tickets.filter(t => t.status === 'open').length}`,
        [
          [{ text: '🔙 Back to Admin', action: 'admin_dashboard' }]
        ]
      );
    } else if (action.startsWith('admin_approve_')) {
      const paymentId = parseInt(action.replace('admin_approve_', ''), 10);
      onApprovePayment(paymentId);
      addBotMessage(`✅ **Payment #${paymentId} Approved!** Config provisioned in 3x-ui and sent to customer.`);
    } else if (action.startsWith('admin_reject_')) {
      const paymentId = parseInt(action.replace('admin_reject_', ''), 10);
      onRejectPayment(paymentId);
      addBotMessage(`❌ **Payment #${paymentId} Rejected.** Customer has been notified.`);
    }
  };

  const handleAdminMenu = () => {
    addBotMessage(
      `🛡 **FastVPN Admin Control Center**\n\nSelect an administrative module:`,
      [
        [
          { text: '📦 Manage Plans (CRUD)', action: 'admin_plans_mgmt' },
          { text: '💳 Card & Payment Settings', action: 'admin_card_settings' }
        ],
        [
          { text: '📊 Sales & Statistics', action: 'admin_stats' },
          { text: '🎫 View Tickets Queue', action: 'admin_tickets' }
        ],
        [
          { text: '🔙 Switch to User Menu', action: 'menu_main' }
        ]
      ]
    );
  };

  // Submit Receipt Modal Action
  const handleConfirmReceipt = () => {
    if (!pendingOrderDetails) return;
    setIsReceiptModalOpen(false);

    // Call state handler
    onSubmitReceipt(
      pendingOrderDetails.planId,
      pendingOrderDetails.amount,
      pendingOrderDetails.type,
      selectedReceiptPreset.url
    );

    // Add confirmation in chat
    addBotMessage(
      `✅ **Receipt Received!**\n\nYour payment of **$${pendingOrderDetails.amount.toFixed(2)}** for **${pendingOrderDetails.planName}** has been forwarded to our admin team for verification.\n\nYou will receive your configuration and QR code as soon as the admin verifies the transfer.`
    );

    // Also switch to admin view or notify admin
    setTimeout(() => {
      const newPayId = payments.length + 1;
      const adminNoticeText = `🔔 **New Payment Receipt Pending Approval!**\n\n🆔 Payment #${newPayId}\n👤 User: Alex Cooper (@alex_c, ID: 55443322)\n💵 Amount: $${pendingOrderDetails.amount.toFixed(2)}\n📦 Purpose: ${pendingOrderDetails.planName}\n\nReview the screenshot and approve or reject:`;
      
      const adminNotice: TelegramMessage = {
        id: `admin-notice-${Date.now()}`,
        sender: 'bot',
        chatType: 'admin_channel',
        text: adminNoticeText,
        photoUrl: selectedReceiptPreset.url,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        inlineButtons: [
          [
            { text: '✅ Approve Payment', action: `admin_approve_${newPayId}` },
            { text: '❌ Reject Payment', action: `admin_reject_${newPayId}` }
          ]
        ]
      };
      setMessages(prev => [...prev, adminNotice]);
    }, 600);
  };

  const handleCreateTicketSubmit = () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;
    setTicketSubjectModal(false);
    onCreateTicket(currentUser.id, newTicketSubject.trim(), newTicketMessage.trim());

    addBotMessage(
      `✅ **Support Ticket Created!**\n\n📌 **Subject:** ${newTicketSubject}\n💬 **Message:** ${newTicketMessage}\n\nOur support team will reply inside this bot chat soon.`
    );
    setNewTicketSubject('');
    setNewTicketMessage('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      {/* Left Control Bar & Perspective Toggle */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Perspective Selector Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Perspective</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Live Simulator
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 mb-4">
            <button
              onClick={() => setPerspective('customer')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                perspective === 'customer'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Customer</span>
            </button>
            <button
              onClick={() => setPerspective('admin')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                perspective === 'admin'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin ID</span>
            </button>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Telegram User:</span>
              <span className="font-medium text-white">{currentUser.firstName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Telegram ID:</span>
              <span className="font-mono text-cyan-300">`{currentUser.id}`</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Wallet Balance:</span>
              <span className="font-semibold text-emerald-400">${currentUser.balance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Role:</span>
              <span className={`font-medium ${currentUser.isAdmin ? 'text-purple-400' : 'text-blue-400'}`}>
                {currentUser.isAdmin ? '👑 Hardcoded Admin' : '👤 Customer'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Simulator Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Simulator Shortcuts</span>
          
          <button
            onClick={() => handleInlineAction('menu_main')}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 flex items-center justify-between transition-all"
          >
            <span>Run `/start` Command</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => handleInlineAction('user_buy')}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 flex items-center justify-between transition-all"
          >
            <span>🛒 Buy Plan Flow</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => handleInlineAction('user_trial')}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 flex items-center justify-between transition-all"
          >
            <span>🎁 Claim Free Trial</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => {
              setPendingOrderDetails({ amount: 5.0, type: 'plan', planName: '1 Month Unlimited VIP', planId: 1 });
              setIsReceiptModalOpen(true);
            }}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/30 flex items-center justify-between transition-all"
          >
            <span>📸 Test Receipt Upload</span>
            <Upload className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <button
            onClick={handleAdminMenu}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-700/40 flex items-center justify-between transition-all"
          >
            <span>🛡 Open Admin Panel (/admin)</span>
            <Shield className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>

        {/* Active Bank Card Display */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Merchant Card (Active)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 font-mono text-cyan-300 text-sm tracking-wider flex items-center justify-between">
            <span>{cardNumber}</span>
            <button 
              onClick={() => handleCopy(cardNumber, 'Card Number')}
              className="text-slate-400 hover:text-white p-1"
              title="Copy Card"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-400 text-[11px]">Holder: <span className="text-slate-200 font-medium">{cardHolder}</span></p>
          {copyFeedback && (
            <p className="text-[11px] text-emerald-400 animate-fade-in font-medium">Copied {copyFeedback} to clipboard!</p>
          )}
        </div>
      </div>

      {/* Main Telegram Chat Window */}
      <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[740px]">
        {/* Telegram Chat Header */}
        <div className="bg-slate-900/90 backdrop-blur px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-sm">FastVPN Bot</h3>
                <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase">bot</span>
              </div>
              <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                online • 3x-ui connected
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Viewing as:</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              perspective === 'customer' 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
            }`}>
              {perspective === 'customer' ? 'Customer (@alex_c)' : 'Admin (@vpn_owner)'}
            </span>
          </div>
        </div>

        {/* Chat Message List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/90 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            const isMe = msg.sender === perspective;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[90%] sm:max-w-[80%] ${
                  isMe ? 'ml-auto' : 'mr-auto'
                }`}
              >
                {/* Chat Bubble */}
                <div
                  className={`rounded-2xl p-3.5 shadow-md text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : isBot
                      ? 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-none'
                      : 'bg-purple-900/60 text-purple-100 border border-purple-700/50 rounded-br-none'
                  }`}
                >
                  {/* Photo or Receipt image if present */}
                  {msg.photoUrl && (
                    <div className="mb-2.5 overflow-hidden rounded-xl border border-slate-700/50">
                      <img
                        src={msg.photoUrl}
                        alt="Payment Receipt"
                        className="max-h-56 w-full object-cover"
                      />
                    </div>
                  )}

                  {/* QR Code image if generated */}
                  {msg.qrData && (
                    <div className="mb-2.5 p-2 bg-white rounded-xl flex items-center justify-center">
                      <img
                        src={msg.qrData}
                        alt="VPN QR Code"
                        className="w-44 h-44 object-contain"
                      />
                    </div>
                  )}

                  {/* Message Text with markdown formatting */}
                  <div className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                    {msg.text.split('\n').map((line, idx) => (
                      <React.Fragment key={idx}>
                        {line.startsWith('`') && line.endsWith('`') ? (
                          <code className="block bg-slate-950/80 px-2 py-1 rounded text-cyan-300 font-mono text-[11px] overflow-x-auto my-1 border border-slate-700/60">
                            {line.replace(/`/g, '')}
                          </code>
                        ) : (
                          <span>{line}</span>
                        )}
                        <br />
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-cyan-300 inline" />}
                  </div>
                </div>

                {/* Inline Buttons Keyboard (Below Message) */}
                {msg.inlineButtons && msg.inlineButtons.length > 0 && (
                  <div className="mt-2 w-full space-y-1.5">
                    {msg.inlineButtons.map((row, rIdx) => (
                      <div key={rIdx} className="grid grid-flow-col auto-cols-fr gap-1.5">
                        {row.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            onClick={() => handleInlineAction(btn.action)}
                            className="bg-slate-800/90 hover:bg-slate-700 active:bg-blue-600 text-slate-200 hover:text-white border border-slate-700/70 hover:border-blue-500/50 text-xs font-medium py-2 px-3 rounded-xl transition-all shadow-sm truncate text-center"
                          >
                            {btn.text}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2">
          <button
            onClick={() => {
              setPendingOrderDetails({ amount: 5.0, type: 'plan', planName: '1 Month Unlimited VIP', planId: 1 });
              setIsReceiptModalOpen(true);
            }}
            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-all"
            title="Attach Receipt Screenshot"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message or /start, /admin..."
            className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Screenshot Upload Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                Upload Payment Receipt Screenshot
              </h3>
              <button 
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select one of the sample bank receipts below or click confirm to simulate the user uploading proof of transfer:
            </p>

            <div className="space-y-2">
              {SAMPLE_RECEIPT_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedReceiptPreset(preset)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                    selectedReceiptPreset.name === preset.name
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img 
                      src={preset.url} 
                      alt={preset.name} 
                      className="w-12 h-12 object-cover rounded-lg border border-slate-700" 
                    />
                    <div>
                      <p className="text-xs font-semibold">{preset.name}</p>
                      <p className="text-[11px] text-slate-400">Sender: {preset.sender}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">${preset.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Card:</span>
                <span className="font-mono text-cyan-300">{cardNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cardholder:</span>
                <span className="text-slate-200">{cardHolder}</span>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReceipt}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
              >
                Submit Receipt Screenshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Ticket Modal */}
      {ticketSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Ticket className="w-5 h-5 text-blue-400" />
                Open Support Ticket
              </h3>
              <button 
                onClick={() => setTicketSubjectModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Subject</label>
              <input
                type="text"
                value={newTicketSubject}
                onChange={(e) => setNewTicketSubject(e.target.value)}
                placeholder="e.g. iOS Streisand connection problem"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Detailed Message</label>
              <textarea
                value={newTicketMessage}
                onChange={(e) => setNewTicketMessage(e.target.value)}
                rows={3}
                placeholder="Describe your issue or question..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setTicketSubjectModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicketSubmit}
                disabled={!newTicketSubject.trim() || !newTicketMessage.trim()}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold"
              >
                Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
