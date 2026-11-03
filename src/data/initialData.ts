import { Plan, ProtocolItem, InboundItem, SupportTicket, TelegramUser } from '../types';

export const INITIAL_USERS: TelegramUser[] = [
  {
    id: 55443322,
    firstName: 'Alex Cooper',
    username: 'alex_c',
    balance: 5.0,
    trialClaimed: false,
    isAdmin: false
  },
  {
    id: 123456789,
    firstName: 'Super Admin',
    username: 'vpn_owner',
    balance: 100.0,
    trialClaimed: true,
    isAdmin: true
  }
];

export const INITIAL_PLANS: Plan[] = [
  {
    id: 1,
    name: '1 Month Unlimited VIP',
    price: 5.0,
    durationDays: 30,
    trafficGb: 0,
    protocol: 'Tunnel (VLESS-Reality)',
    serverId: 1,
    isActive: true
  },
  {
    id: 2,
    name: '3 Months Unlimited VIP',
    price: 13.5,
    durationDays: 90,
    trafficGb: 0,
    protocol: 'Tunnel (VLESS-Reality)',
    serverId: 1,
    isActive: true
  },
  {
    id: 3,
    name: '50 GB Traffic Only (No Expiry)',
    price: 3.5,
    durationDays: 0,
    trafficGb: 50,
    protocol: 'Direct (VLESS / VMess / Trojan)',
    serverId: 1,
    isActive: true
  },
  {
    id: 4,
    name: 'WireGuard Turbo 100 GB (30 Days)',
    price: 7.0,
    durationDays: 30,
    trafficGb: 100,
    protocol: 'WireGuard-Tunnel',
    serverId: 2,
    isActive: true
  }
];

export const INITIAL_PROTOCOLS: ProtocolItem[] = [
  {
    key: 'tunnel',
    name: 'Tunnel (VLESS-Reality)',
    description: 'Anti-censorship TLS spoofing with XTLS-Vision flow',
    isEnabled: true
  },
  {
    key: 'wireguard',
    name: 'WireGuard-Tunnel',
    description: 'Kernel-level high performance VPN tunnel for gaming & streaming',
    isEnabled: true
  },
  {
    key: 'direct',
    name: 'Direct (VLESS / VMess / Trojan)',
    description: 'Ultra-low ping high throughput direct connection',
    isEnabled: true
  }
];

export const INITIAL_INBOUNDS: InboundItem[] = [
  {
    id: 1,
    remark: 'VLESS-Reality-Tunnel',
    port: 443,
    protocol: 'vless',
    settings: {
      clients: [
        {
          id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          email: 'sample_vip_user',
          totalGB: 0,
          expiryTime: Date.now() + 25 * 86400 * 1000,
          enable: true
        }
      ]
    },
    streamSettings: {
      network: 'tcp',
      security: 'reality',
      realitySettings: {
        serverNames: ['zoom.us', 'microsoft.com'],
        publicKey: 'B69aB6k9X9N2aVzL7uW2mK3qJ8vY1pC5rT4eR7wQ0',
        shortIds: ['16a8c4f9', '7d2e0b11']
      }
    }
  },
  {
    id: 2,
    remark: 'WireGuard-HighSpeed',
    port: 51820,
    protocol: 'wireguard',
    settings: {
      clients: [
        {
          id: 'wg-client-01',
          email: 'wg_sample_user',
          totalGB: 100 * 1073741824,
          expiryTime: Date.now() + 30 * 86400 * 1000,
          enable: true
        }
      ]
    },
    streamSettings: {
      network: 'udp',
      security: 'none'
    }
  },
  {
    id: 3,
    remark: 'Direct-Trojan-TLS',
    port: 8443,
    protocol: 'trojan',
    settings: {
      clients: []
    },
    streamSettings: {
      network: 'ws',
      security: 'tls'
    }
  }
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 101,
    userId: 55443322,
    userName: 'Alex Cooper',
    subject: 'Best app for iPhone iOS 18?',
    status: 'open',
    createdAt: '10 mins ago',
    messages: [
      {
        id: 1,
        sender: 'user',
        senderName: 'Alex Cooper',
        text: 'Hello, what free client app do you recommend on Apple App Store for VLESS Reality?',
        time: '10 mins ago'
      }
    ]
  }
];

export const SAMPLE_RECEIPT_PRESETS = [
  {
    name: 'Standard Bank Transfer ($5.00)',
    amount: 5.0,
    sender: 'Alex Cooper',
    url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Top-Up Transfer ($15.00)',
    amount: 15.0,
    sender: 'Alex Cooper',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80'
  }
];
