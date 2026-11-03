export interface TelegramUser {
  id: number;
  firstName: string;
  username: string;
  balance: number;
  trialClaimed: boolean;
  isAdmin: boolean;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  durationDays: number;
  trafficGb: number;
  protocol: string;
  serverId: number;
  isActive: boolean;
}

export interface ProtocolItem {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
}

export interface PaymentRecord {
  id: number;
  userId: number;
  userName: string;
  planId?: number;
  planName?: string;
  amount: number;
  type: 'plan' | 'topup';
  status: 'pending' | 'approved' | 'rejected';
  screenshotUrl: string;
  createdAt: string;
}

export interface VpnConfigItem {
  id: number;
  userId: number;
  planId?: number;
  clientUuid: string;
  inboundId: number;
  email: string;
  protocol: string;
  trafficLimitBytes: number;
  trafficUsedBytes: number;
  expiryTimeMs: number;
  configLink: string;
  rawConfig: string;
  isActive: boolean;
  createdAt: string;
}

export interface InboundItem {
  id: number;
  remark: string;
  port: number;
  protocol: string;
  settings: {
    clients: Array<{
      id: string;
      email: string;
      totalGB: number;
      expiryTime: number;
      enable: boolean;
    }>;
  };
  streamSettings: {
    network: string;
    security: string;
    realitySettings?: {
      serverNames: string[];
      publicKey: string;
      shortIds: string[];
    };
  };
}

export interface SupportTicket {
  id: number;
  userId: number;
  userName: string;
  subject: string;
  status: 'open' | 'resolved';
  createdAt: string;
  messages: Array<{
    id: number;
    sender: 'user' | 'admin';
    senderName: string;
    text: string;
    time: string;
  }>;
}

export interface TelegramMessage {
  id: string;
  sender: 'bot' | 'user' | 'admin';
  recipientId?: number; // target chat
  chatType: 'user_bot' | 'admin_channel';
  text: string;
  photoUrl?: string;
  qrData?: string;
  inlineButtons?: Array<Array<{
    text: string;
    action: string;
    url?: string;
  }>>;
  timestamp: string;
}
