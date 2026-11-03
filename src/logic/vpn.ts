/**
 * Pure business logic and calculation utilities for 3x-UI VPN bot operations.
 */

export interface PlanData {
  id?: number;
  name: string;
  price: number;
  durationDays: number;
  trafficGb: number;
  protocol: string;
  serverId?: number;
  isActive?: boolean;
}

export interface PaymentState {
  id: number;
  userId: number;
  planId?: number;
  amount: number;
  type: 'plan' | 'topup';
  status: 'pending' | 'approved' | 'rejected';
  screenshotUrl?: string;
  createdAt: number;
}

export interface UserAccount {
  id: number;
  telegramId: number;
  username?: string;
  firstName: string;
  balance: number;
  trialClaimed: boolean;
}

export function calculateTrafficBytes(gb: number): number {
  if (gb <= 0) return 0;
  return Math.floor(gb * 1024 * 1024 * 1024);
}

export function calculateExpiryMs(days: number, fromMs: number = Date.now()): number {
  if (days <= 0) return 0;
  return fromMs + (days * 24 * 60 * 60 * 1000);
}

export function formatTraffic(bytes: number): string {
  if (bytes <= 0) return 'Unlimited';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB`;
}

export function formatDuration(days: number): string {
  if (days <= 0) return 'No Time Limit';
  return `${days} Days`;
}

export function validatePlanInput(plan: Partial<PlanData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!plan.name || plan.name.trim().length === 0) {
    errors.push('Plan name is required.');
  }
  if (plan.price === undefined || isNaN(plan.price) || plan.price < 0) {
    errors.push('Price must be a positive number.');
  }
  if (plan.durationDays === undefined || isNaN(plan.durationDays) || plan.durationDays < 0) {
    errors.push('Duration days must be 0 or greater.');
  }
  if (plan.trafficGb === undefined || isNaN(plan.trafficGb) || plan.trafficGb < 0) {
    errors.push('Traffic GB must be 0 or greater.');
  }
  if (!plan.protocol || plan.protocol.trim().length === 0) {
    errors.push('Protocol type is required.');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

export function buildVlessRealityUri(params: {
  uuid: string;
  host: string;
  port: number;
  publicKey: string;
  sni: string;
  shortId?: string;
  remark: string;
}): string {
  const { uuid, host, port, publicKey, sni, shortId = '', remark } = params;
  const sid = encodeURIComponent(shortId);
  const pbk = encodeURIComponent(publicKey);
  const rem = encodeURIComponent(remark);
  return `vless://${uuid}@${host}:${port}?type=tcp&security=reality&pbk=${pbk}&fp=chrome&sni=${sni}&sid=${sid}&spx=%2F&flow=xtls-rprx-vision#${rem}`;
}

export function buildWireguardConfig(params: {
  clientPrivateKey: string;
  clientAddress: string;
  serverPublicKey: string;
  endpoint: string;
  dns?: string;
}): string {
  const { clientPrivateKey, clientAddress, serverPublicKey, endpoint, dns = '1.1.1.1, 8.8.8.8' } = params;
  return `[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientAddress}
DNS = ${dns}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;
}

export function processPaymentApproval(
  payment: PaymentState,
  user: UserAccount,
  plan?: PlanData
): {
  updatedPayment: PaymentState;
  updatedUser: UserAccount;
  createdConfigDetails?: {
    email: string;
    trafficBytes: number;
    expiryMs: number;
  };
} {
  if (payment.status !== 'pending') {
    throw new Error(`Cannot approve payment with status ${payment.status}`);
  }

  const updatedPayment: PaymentState = {
    ...payment,
    status: 'approved'
  };

  if (payment.type === 'topup') {
    const updatedUser: UserAccount = {
      ...user,
      balance: +(user.balance + payment.amount).toFixed(2)
    };
    return { updatedPayment, updatedUser };
  } else {
    // Plan payment
    const updatedUser = { ...user };
    const trafficBytes = plan ? calculateTrafficBytes(plan.trafficGb) : 0;
    const expiryMs = plan ? calculateExpiryMs(plan.durationDays) : 0;
    return {
      updatedPayment,
      updatedUser,
      createdConfigDetails: {
        email: `user_${user.telegramId}_${payment.planId || 1}`,
        trafficBytes,
        expiryMs
      }
    };
  }
}

export function processPaymentRejection(payment: PaymentState): PaymentState {
  if (payment.status !== 'pending') {
    throw new Error(`Cannot reject payment with status ${payment.status}`);
  }
  return {
    ...payment,
    status: 'rejected'
  };
}
