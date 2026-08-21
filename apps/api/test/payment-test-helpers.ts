import app from '../src/app';
import { asPatient, asProvider, createTestUser, createTestOrganization } from './test-helpers';
import type { PaymentConnections } from '../src/services/payment-connections/payment-connections.class';
import type { PaymentProvider } from '../src/services/payments/payment-provider';
import type { Charge, CreateChargeParams } from '../src/services/payments/domain';

export { asPatient, asProvider };

export const createTestPatient = async (tag: string) => {
  const s = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${tag}`;
  return app.service('patients').create({
    medicare: `PAY-${s}`,
    medicareNumber: `50001-${s}`,
  });
};

export interface PaidMedicSetup {
  org: any;
  medic: any;
  providerAccountId: string;
}

// A professional with everything needed for effective payment collection:
// role, org, a _particular.encounter price, enabled payment settings, and a
// connected (fake) provider account.
export async function setupPaidMedic(options: {
  tag: string;
  mode?: 'optional' | 'required';
  chargePortion?: 25 | 50 | 100;
  priceInPesos?: number;
  holdWindowMinutes?: number;
  enabled?: boolean;
  connected?: boolean;
}): Promise<PaidMedicSetup> {
  const {
    tag,
    mode = 'optional',
    chargePortion = 100,
    priceInPesos = 5000,
    holdWindowMinutes = 20,
    enabled = true,
    connected = true,
  } = options;

  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const org = await createTestOrganization({ slug: `pay-${tag}-${stamp}` });
  const medic = await createTestUser({
    username: `pay.${tag}.${stamp}@test.com`,
    password: 'SuperSecret1!',
    roleIds: ['medic'],
    organizationId: org.id,
  });

  await app.service('accounting-settings').create({
    userId: medic.id,
    organizationId: org.id,
    insurerPrices: { _particular: { encounter: priceInPesos } },
  }, { provider: undefined });

  await app.service('payment-settings').create({
    userId: medic.id,
    organizationId: org.id,
    enabled,
    chargePortion,
    requirementMode: mode,
    holdWindowMinutes,
  }, { provider: undefined });

  const providerAccountId = `acct-${stamp}`;

  if (connected) {
    const connections = app.service('payment-connections') as unknown as PaymentConnections;
    await connections.storeCredentials(String(medic.id), 'mercado_pago', {
      accessToken: `seller-token-${stamp}`,
      refreshToken: `seller-refresh-${stamp}`,
      providerAccountId,
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
    }, { logEvent: false });
  }

  return { org, medic, providerAccountId };
}

export interface FakeProviderState {
  chargeCalls: CreateChargeParams[];
  getChargeCalls: string[];
  refundCalls: string[];
  chargeImpl: (params: CreateChargeParams) => Promise<Charge>;
  getChargeImpl: (providerPaymentId: string) => Promise<Charge>;
}

export function makeChargeProvider(): { provider: PaymentProvider; state: FakeProviderState } {
  const state: FakeProviderState = {
    chargeCalls: [],
    getChargeCalls: [],
    refundCalls: [],
    chargeImpl: async (params) => ({
      providerChargeId: `pref-${params.externalReference}`,
      checkoutUrl: `https://fake.mp/checkout/${params.externalReference}`,
      status: 'pending',
      amount: params.amount,
      externalReference: params.externalReference,
      refundedAmount: null,
    }),
    getChargeImpl: async () => {
      throw new Error('getChargeImpl not configured');
    },
  };

  const provider: PaymentProvider = {
    id: 'mercado_pago',
    getAuthorizationUrl: () => 'https://fake.mp/authorization',
    async exchangeCode() {
      throw new Error('not used');
    },
    async refreshCredentials(credentials) {
      return credentials;
    },
    async revoke() {
      return undefined;
    },
    async createCharge(params) {
      state.chargeCalls.push(params);
      return state.chargeImpl(params);
    },
    async getCharge(params) {
      state.getChargeCalls.push(params.providerPaymentId);
      return state.getChargeImpl(params.providerPaymentId);
    },
    async refundCharge(params) {
      state.refundCalls.push(params.providerPaymentId);
      return { providerRefundId: `re-${params.providerPaymentId}`, status: 'requested', amount: params.amount ?? null };
    },
    verifyWebhook() {
      return { valid: true };
    },
    parseWebhook() {
      return { kind: 'ignored', providerEventId: 'x', topic: 'x' };
    },
  };

  return { provider, state };
}
