import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrafficBytes,
  calculateExpiryMs,
  formatTraffic,
  formatDuration,
  validatePlanInput,
  buildVlessRealityUri,
  buildWireguardConfig,
  processPaymentApproval,
  processPaymentRejection,
  PaymentState,
  UserAccount,
  PlanData
} from './vpn';

test('traffic calculations correctly handle 0 and gigabyte units', () => {
  assert.equal(calculateTrafficBytes(0), 0);
  assert.equal(calculateTrafficBytes(1), 1073741824);
  assert.equal(calculateTrafficBytes(50), 50 * 1073741824);

  assert.equal(formatTraffic(0), 'Unlimited');
  assert.equal(formatTraffic(1073741824), '1 GB');
  assert.equal(formatTraffic(53687091200), '50 GB');
});

test('duration calculations correctly handle 0 and days', () => {
  assert.equal(calculateExpiryMs(0), 0);
  const now = 1700000000000;
  const in30Days = calculateExpiryMs(30, now);
  assert.equal(in30Days, now + (30 * 24 * 60 * 60 * 1000));

  assert.equal(formatDuration(0), 'No Time Limit');
  assert.equal(formatDuration(30), '30 Days');
});

test('plan input validator catches invalid configurations', () => {
  const invalid = validatePlanInput({
    name: '',
    price: -5,
    durationDays: -1,
    trafficGb: -10,
    protocol: ''
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 4);

  const valid = validatePlanInput({
    name: '1 Month Unlimited',
    price: 5.0,
    durationDays: 30,
    trafficGb: 0,
    protocol: 'Tunnel (VLESS-Reality)'
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});

test('VLESS-Reality URI builder produces valid connection string', () => {
  const uri = buildVlessRealityUri({
    uuid: '11111111-2222-3333-4444-555555555555',
    host: 'vpn.example.com',
    port: 443,
    publicKey: 'abc_pub_key',
    sni: 'zoom.us',
    shortId: '1234',
    remark: 'FastVPN-Test'
  });
  assert.ok(uri.startsWith('vless://11111111-2222-3333-4444-555555555555@vpn.example.com:443'));
  assert.ok(uri.includes('security=reality'));
  assert.ok(uri.includes('pbk=abc_pub_key'));
  assert.ok(uri.includes('sni=zoom.us'));
});

test('WireGuard config builder formats valid interface/peer profile', () => {
  const wg = buildWireguardConfig({
    clientPrivateKey: 'client_priv_key==',
    clientAddress: '10.0.0.2/32',
    serverPublicKey: 'server_pub_key==',
    endpoint: 'vpn.example.com:51820'
  });
  assert.ok(wg.includes('[Interface]'));
  assert.ok(wg.includes('PrivateKey = client_priv_key=='));
  assert.ok(wg.includes('Endpoint = vpn.example.com:51820'));
});

test('payment state machine transitions correctly for topup and plan approval', () => {
  const mockUser: UserAccount = {
    id: 1,
    telegramId: 987654321,
    firstName: 'Alice',
    balance: 10.0,
    trialClaimed: false
  };

  const topupPayment: PaymentState = {
    id: 101,
    userId: 987654321,
    amount: 15.0,
    type: 'topup',
    status: 'pending',
    createdAt: Date.now()
  };

  const topupResult = processPaymentApproval(topupPayment, mockUser);
  assert.equal(topupResult.updatedPayment.status, 'approved');
  assert.equal(topupResult.updatedUser.balance, 25.0);

  const planPayment: PaymentState = {
    id: 102,
    userId: 987654321,
    planId: 2,
    amount: 7.0,
    type: 'plan',
    status: 'pending',
    createdAt: Date.now()
  };

  const plan: PlanData = {
    id: 2,
    name: 'WireGuard 100 GB',
    price: 7.0,
    durationDays: 30,
    trafficGb: 100,
    protocol: 'WireGuard-Tunnel'
  };

  const planResult = processPaymentApproval(planPayment, mockUser, plan);
  assert.equal(planResult.updatedPayment.status, 'approved');
  assert.ok(planResult.createdConfigDetails);
  assert.equal(planResult.createdConfigDetails.trafficBytes, 100 * 1073741824);

  const rejected = processPaymentRejection(planPayment);
  assert.equal(rejected.status, 'rejected');
});
