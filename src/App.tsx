import React, { useState } from 'react';
import { Header } from './components/Header';
import { TelegramSimulator } from './components/TelegramSimulator';
import { XuiConsole } from './components/XuiConsole';
import { CodebaseHub } from './components/CodebaseHub';
import { ConfigSettings } from './components/ConfigSettings';
import { 
  INITIAL_USERS, 
  INITIAL_PLANS, 
  INITIAL_PROTOCOLS, 
  INITIAL_INBOUNDS, 
  INITIAL_TICKETS 
} from './data/initialData';
import { 
  TelegramUser, 
  Plan, 
  ProtocolItem, 
  PaymentRecord, 
  VpnConfigItem, 
  InboundItem, 
  SupportTicket 
} from './types';
import { buildVlessRealityUri, buildWireguardConfig } from './logic/vpn';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'xui' | 'codebase' | 'settings'>('simulator');
  
  // Application Data States
  const [users, setUsers] = useState<TelegramUser[]>(INITIAL_USERS);
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const [protocols, setProtocols] = useState<ProtocolItem[]>(INITIAL_PROTOCOLS);
  const [inbounds, setInbounds] = useState<InboundItem[]>(INITIAL_INBOUNDS);
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  
  // Card Settings
  const [cardNumber, setCardNumber] = useState<string>('4400 1234 5678 9012');
  const [cardHolder, setCardHolder] = useState<string>('John Doe (FastVPN Merchant)');

  // Trial Settings
  const [trialSettings, setTrialSettings] = useState({
    enabled: true,
    days: 1,
    trafficGb: 1,
    protocol: 'Tunnel (VLESS-Reality)'
  });

  // Active VPN Configs
  const [configs, setConfigs] = useState<VpnConfigItem[]>([
    {
      id: 1,
      userId: 55443322,
      planId: 1,
      clientUuid: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      inboundId: 1,
      email: 'user_55443322_1',
      protocol: 'Tunnel (VLESS-Reality)',
      trafficLimitBytes: 0,
      trafficUsedBytes: 429496729,
      expiryTimeMs: Date.now() + 25 * 86400 * 1000,
      configLink: buildVlessRealityUri({
        uuid: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        host: 'vpn.fastpanel.net',
        port: 443,
        publicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
        sni: 'zoom.us',
        shortId: '16a8c4f9',
        remark: 'FastVPN-AlexCooper-VIP'
      }),
      rawConfig: '',
      isActive: true,
      createdAt: 'Yesterday'
    }
  ]);

  // Payment Receipts Queue
  const [payments, setPayments] = useState<PaymentRecord[]>([
    {
      id: 1,
      userId: 55443322,
      userName: 'Alex Cooper',
      planId: 1,
      planName: '1 Month Unlimited VIP',
      amount: 5.0,
      type: 'plan',
      status: 'approved',
      screenshotUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80',
      createdAt: 'Yesterday'
    }
  ]);

  // Handlers
  const handleUpdateBalance = (userId: number, delta: number) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return { ...u, balance: Math.max(0, +(u.balance + delta).toFixed(2)) };
      }
      return u;
    }));
  };

  const handleSubmitReceipt = (planId: number | undefined, amount: number, type: 'plan' | 'topup', screenshotUrl: string) => {
    const customer = users.find(u => !u.isAdmin) || users[0];
    const plan = plans.find(p => p.id === planId);

    const newPayment: PaymentRecord = {
      id: payments.length + 1,
      userId: customer.id,
      userName: customer.firstName,
      planId,
      planName: plan ? plan.name : 'Account Top-Up',
      amount,
      type,
      status: 'pending',
      screenshotUrl,
      createdAt: 'Just now'
    };

    setPayments(prev => [...prev, newPayment]);
  };

  const handleApprovePayment = (paymentId: number) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    // Update payment record
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'approved' } : p));

    if (payment.type === 'topup') {
      // Add balance
      handleUpdateBalance(payment.userId, payment.amount);
    } else {
      // Provision plan in 3x-ui
      const plan = plans.find(p => p.id === payment.planId);
      const clientUuid = 'client-' + Math.random().toString(36).substring(2, 8) + '-8899-aabb-ccddeeff0011';
      const inboundId = plan && plan.protocol.includes('WireGuard') ? 2 : 1;
      const email = `user_${payment.userId}_${payment.planId || 1}`;
      
      let configLink = '';
      if (plan && plan.protocol.includes('WireGuard')) {
        configLink = buildWireguardConfig({
          clientPrivateKey: 'client_sample_private_key_base64==',
          clientAddress: '10.0.0.8/32',
          serverPublicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
          endpoint: 'vpn.fastpanel.net:51820'
        });
      } else {
        configLink = buildVlessRealityUri({
          uuid: clientUuid,
          host: 'vpn.fastpanel.net',
          port: 443,
          publicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
          sni: 'zoom.us',
          shortId: '16a8c4f9',
          remark: `FastVPN-${payment.userName.replace(/\s+/g, '')}`
        });
      }

      const newConfig: VpnConfigItem = {
        id: configs.length + 1,
        userId: payment.userId,
        planId: payment.planId,
        clientUuid,
        inboundId,
        email,
        protocol: plan ? plan.protocol : 'Tunnel (VLESS-Reality)',
        trafficLimitBytes: plan && plan.trafficGb > 0 ? plan.trafficGb * 1073741824 : 0,
        trafficUsedBytes: 0,
        expiryTimeMs: plan && plan.durationDays > 0 ? Date.now() + plan.durationDays * 86400 * 1000 : 0,
        configLink,
        rawConfig: configLink,
        isActive: true,
        createdAt: 'Just now'
      };

      setConfigs(prev => [newConfig, ...prev]);

      // Add to 3x-ui inbound simulator
      setInbounds(prev => prev.map(ib => {
        if (ib.id === inboundId) {
          return {
            ...ib,
            settings: {
              clients: [
                ...ib.settings.clients,
                {
                  id: clientUuid,
                  email,
                  totalGB: plan ? plan.trafficGb * 1073741824 : 0,
                  expiryTime: plan && plan.durationDays > 0 ? Date.now() + plan.durationDays * 86400 * 1000 : 0,
                  enable: true
                }
              ]
            }
          };
        }
        return ib;
      }));
    }
  };

  const handleRejectPayment = (paymentId: number) => {
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'rejected' } : p));
  };

  const handleClaimTrial = (userId: number) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, trialClaimed: true } : u));
    
    const clientUuid = 'trial-uuid-' + Math.random().toString(36).substring(2, 8);
    const email = `trial_${userId}`;
    const trialUri = buildVlessRealityUri({
      uuid: clientUuid,
      host: 'vpn.fastpanel.net',
      port: 443,
      publicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
      sni: 'zoom.us',
      shortId: '16a8c4f9',
      remark: 'FastVPN-FreeTrial'
    });

    const newConfig: VpnConfigItem = {
      id: configs.length + 1,
      userId,
      clientUuid,
      inboundId: 1,
      email,
      protocol: trialSettings.protocol,
      trafficLimitBytes: trialSettings.trafficGb * 1073741824,
      trafficUsedBytes: 0,
      expiryTimeMs: Date.now() + trialSettings.days * 86400 * 1000,
      configLink: trialUri,
      rawConfig: trialUri,
      isActive: true,
      createdAt: 'Just now'
    };

    setConfigs(prev => [newConfig, ...prev]);
  };

  const handleCreateTicket = (userId: number, subject: string, message: string) => {
    const user = users.find(u => u.id === userId);
    const newTicket: SupportTicket = {
      id: tickets.length + 101,
      userId,
      userName: user ? user.firstName : 'User',
      subject,
      status: 'open',
      createdAt: 'Just now',
      messages: [
        {
          id: 1,
          sender: 'user',
          senderName: user ? user.firstName : 'User',
          text: message,
          time: 'Just now'
        }
      ]
    };
    setTickets(prev => [newTicket, ...prev]);
  };

  const handleReplyTicket = (ticketId: number, sender: 'user' | 'admin', text: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'open',
          messages: [
            ...t.messages,
            {
              id: t.messages.length + 1,
              sender,
              senderName: sender === 'admin' ? 'Chief Admin' : t.userName,
              text,
              time: 'Just now'
            }
          ]
        };
      }
      return t;
    }));
  };

  const handleTogglePlan = (planId: number) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, isActive: !p.isActive } : p));
  };

  const handleToggleProtocol = (key: string) => {
    setProtocols(prev => prev.map(p => p.key === key ? { ...p, isEnabled: !p.isEnabled } : p));
  };

  const handleDeleteConfig = (configId: number) => {
    setConfigs(prev => prev.filter(c => c.id !== configId));
  };

  const handleExtendConfig = (configId: number, addGb: number, addDays: number) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === configId) {
        return {
          ...c,
          trafficLimitBytes: c.trafficLimitBytes + addGb * 1073741824,
          expiryTimeMs: c.expiryTimeMs + addDays * 86400 * 1000
        };
      }
      return c;
    }));
  };

  const handleResetData = () => {
    setUsers(INITIAL_USERS);
    setPlans(INITIAL_PLANS);
    setProtocols(INITIAL_PROTOCOLS);
    setInbounds(INITIAL_INBOUNDS);
    setTickets(INITIAL_TICKETS);
  };

  const pendingReceiptsCount = payments.filter(p => p.status === 'pending').length;
  const testCustomer = users.find(u => !u.isAdmin) || users[0];

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingReceiptsCount={pendingReceiptsCount}
        activeConfigsCount={configs.length}
        userBalance={testCustomer.balance}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 w-full pb-12">
        {activeTab === 'simulator' && (
          <TelegramSimulator
            users={users}
            plans={plans}
            protocols={protocols}
            payments={payments}
            configs={configs}
            tickets={tickets}
            cardNumber={cardNumber}
            cardHolder={cardHolder}
            trialSettings={trialSettings}
            onApprovePayment={handleApprovePayment}
            onRejectPayment={handleRejectPayment}
            onSubmitReceipt={handleSubmitReceipt}
            onClaimTrial={handleClaimTrial}
            onCreateTicket={handleCreateTicket}
            onReplyTicket={handleReplyTicket}
            onUpdateBalance={handleUpdateBalance}
            onTogglePlan={handleTogglePlan}
            onUpdateCardSettings={(num, holder) => {
              setCardNumber(num);
              setCardHolder(holder);
            }}
          />
        )}

        {activeTab === 'xui' && (
          <XuiConsole
            inbounds={inbounds}
            configs={configs}
            onDeleteConfig={handleDeleteConfig}
            onExtendConfig={handleExtendConfig}
          />
        )}

        {activeTab === 'codebase' && (
          <CodebaseHub />
        )}

        {activeTab === 'settings' && (
          <ConfigSettings
            cardNumber={cardNumber}
            cardHolder={cardHolder}
            protocols={protocols}
            trialSettings={trialSettings}
            onUpdateCardSettings={(num, holder) => {
              setCardNumber(num);
              setCardHolder(holder);
            }}
            onUpdateTrialSettings={setTrialSettings}
            onToggleProtocol={handleToggleProtocol}
            onResetData={handleResetData}
          />
        )}
      </main>
    </div>
  );
}
