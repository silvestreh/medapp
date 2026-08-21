import assert from 'assert';
import crypto from 'crypto';
import app from '../../src/app';
import { asPatient, createTestPatient, makeChargeProvider, setupPaidMedic } from '../payment-test-helpers';
import { setProviderForTesting, resetProvidersForTesting } from '../../src/services/payments/provider-registry';
import { MercadoPagoProvider } from '../../src/services/payments/providers/mercado-pago/mercado-pago-provider';
import type { Charge } from '../../src/services/payments/domain';
import paymentWebhookHandler from '../../src/middleware/payment-webhook-handler';
import { processPaymentEvent } from '../../src/services/payments/process-payment-event';

const WEBHOOK_SECRET = 'whsec-test-secret';

interface FakeRes {
  statusCode: number;
  body: any;
  headersSent: boolean;
}

const makeRes = () => {
  const res: FakeRes & { status: (code: number) => any; json: (body: any) => any } = {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: any) {
      res.body = body;
      res.headersSent = true;
      return res;
    },
  };
  return res;
};

// Builds a signed Mercado Pago-style notification request.
const makeSignedRequest = (options: {
  paymentId: string;
  notificationId?: string;
  requestId?: string;
  ts?: number;
  tamperSignature?: boolean;
  sellerId?: string;
}) => {
  const {
    paymentId,
    notificationId = `evt-${crypto.randomUUID()}`,
    requestId = `req-${crypto.randomUUID()}`,
    ts = Math.floor(Date.now() / 1000),
    tamperSignature = false,
    sellerId = '999',
  } = options;

  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  let signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex');

  if (tamperSignature) {
    signature = signature.replace(/^./, signature.startsWith('0') ? '1' : '0');
  }

  const body = {
    id: notificationId,
    type: 'payment',
    data: { id: paymentId },
    user_id: sellerId,
    live_mode: false,
  };

  return {
    headers: {
      'x-signature': `ts=${ts},v1=${signature}`,
      'x-request-id': requestId,
    },
    query: { type: 'payment', 'data.id': paymentId },
    body,
    rawBody: JSON.stringify(body),
  };
};

const waitForOutcome = async (providerEventId: string, timeoutMs = 4000): Promise<any> => {
  const model = app.get('sequelizeClient').models.payment_webhook_events;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const row: any = await model.findOne({ where: { providerEventId }, raw: true });
    if (row?.outcome) return row;
    if (Date.now() > deadline) return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describe('payment webhooks', function () {
  this.timeout(30000);

  let providerState: ReturnType<typeof makeChargeProvider>['state'];
  const handler = paymentWebhookHandler(app, 'mercado_pago');

  const approvedCharge = (payment: any, overrides: Partial<Charge> = {}): Charge => ({
    providerChargeId: 'mp-pay-1',
    checkoutUrl: null,
    status: 'approved',
    amount: { amount: payment.amount, currency: payment.currency },
    externalReference: String(payment.id),
    refundedAmount: null,
    ...overrides,
  });

  // A provider whose signature logic is the REAL Mercado Pago implementation
  // but whose HTTP surface is stubbed.
  beforeEach(() => {
    const real = new MercadoPagoProvider({ clientId: 'x', clientSecret: 'y', webhookSecret: WEBHOOK_SECRET });
    const { provider, state } = makeChargeProvider();
    providerState = state;
    setProviderForTesting('mercado_pago', {
      ...provider,
      verifyWebhook: (request) => real.verifyWebhook(request),
      parseWebhook: (request) => real.parseWebhook(request),
    });
  });

  after(() => {
    resetProvidersForTesting();
  });

  const bookPaid = async (tag: string, mode: 'optional' | 'required') => {
    const { org, medic, providerAccountId } = await setupPaidMedic({ tag, mode });
    const patient = await createTestPatient(tag);
    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date(`2031-0${mode === 'required' ? 1 : 2}-0${1 + (tag.length % 8)}T1${tag.length % 9}:00:00Z`).toISOString() },
      asPatient(patient.id, org.id)
    ) as any;
    const payment = await app.service('appointment-payments').get(booking.payment.paymentId, { provider: undefined }) as any;
    return { org, medic, patient, booking, payment, providerAccountId };
  };

  const paymentEvent = (eventId: string, providerPaymentId: string, providerAccountId: string) => ({
    kind: 'payment' as const,
    providerEventId: eventId,
    topic: 'payment',
    providerPaymentId,
    providerAccountId,
  });

  it('confirms a required-mode booking on a valid approved notification', async () => {
    const { booking, payment, providerAccountId } = await bookPaid('wh-ok', 'required');
    providerState.getChargeImpl = async () => approvedCharge(payment);

    const req = makeSignedRequest({ paymentId: 'mp-pay-ok-1', sellerId: providerAccountId });
    const res = makeRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, { ok: true });

    const eventRow = await waitForOutcome((req.body as any).id);
    assert.strictEqual(eventRow.outcome, 'processed');

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'confirmed');
    assert.ok(appointment.paidAt);

    const updated = await app.service('appointment-payments').get(payment.id, { provider: undefined }) as any;
    assert.strictEqual(updated.status, 'approved');
    assert.ok(updated.paidAt);
    assert.strictEqual(updated.providerPaymentId, 'mp-pay-ok-1');
  });

  it('rejects an invalid signature without processing', async () => {
    const req = makeSignedRequest({ paymentId: 'mp-pay-bad-sig', tamperSignature: true });
    const res = makeRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(providerState.getChargeCalls.length, 0);
  });

  it('rejects a missing signature', async () => {
    const req = makeSignedRequest({ paymentId: 'mp-pay-no-sig' });
    delete (req.headers as any)['x-signature'];
    const res = makeRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 401);
  });

  it('rejects a stale timestamp', async () => {
    // Older than the 6-hour tolerance (kept wide for MP's slow retry cycle).
    const req = makeSignedRequest({
      paymentId: 'mp-pay-stale',
      ts: Math.floor(Date.now() / 1000) - 7 * 3600,
    });
    const res = makeRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(providerState.getChargeCalls.length, 0);
  });

  it('treats a duplicate delivery as a durable no-op', async () => {
    const { payment, providerAccountId } = await bookPaid('wh-dup', 'required');
    providerState.getChargeImpl = async () => approvedCharge(payment);

    const notificationId = `evt-dup-${crypto.randomUUID()}`;
    const first = makeSignedRequest({ paymentId: 'mp-pay-dup-1', notificationId, sellerId: providerAccountId });
    const firstRes = makeRes();
    await handler(first, firstRes);
    await waitForOutcome(notificationId);

    const replay = makeSignedRequest({ paymentId: 'mp-pay-dup-1', notificationId, sellerId: providerAccountId });
    const replayRes = makeRes();
    await handler(replay, replayRes);

    assert.deepStrictEqual(replayRes.body, { ok: true, duplicate: true });
    assert.strictEqual(providerState.getChargeCalls.length, 1, 'duplicate must not re-fetch or re-process');
  });

  it('collapses out-of-order deliveries into no-ops (status is monotonic)', async () => {
    const { booking, payment, providerAccountId } = await bookPaid('wh-order', 'required');

    providerState.getChargeImpl = async () => approvedCharge(payment);
    let result = await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-order-1', 'mp-pay-order-1', providerAccountId));
    assert.strictEqual(result.outcome, 'processed');

    // A late, older notification re-fetches the authoritative record, which is
    // still approved — no transition, no side effects.
    result = await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-order-2', 'mp-pay-order-1', providerAccountId));
    assert.strictEqual(result.outcome, 'noop');

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'confirmed');
  });

  it('flags an amount mismatch and does NOT confirm', async () => {
    const { booking, payment, providerAccountId } = await bookPaid('wh-amount', 'required');
    providerState.getChargeImpl = async () => approvedCharge(payment, {
      amount: { amount: payment.amount - 100, currency: payment.currency },
    });

    const result = await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-amount-1', 'mp-pay-amount-1', providerAccountId));

    assert.strictEqual(result.outcome, 'flagged');

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'pending_payment', 'mismatched payment must not confirm');

    const updated = await app.service('appointment-payments').get(payment.id, { provider: undefined }) as any;
    assert.strictEqual(updated.flagged, true);
    assert.strictEqual(updated.flagReason, 'amount_mismatch');
  });

  it('records a rejection without releasing the hold', async () => {
    const { booking, payment, providerAccountId } = await bookPaid('wh-rej', 'required');
    providerState.getChargeImpl = async () => approvedCharge(payment, { status: 'rejected' });

    const result = await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-rej-1', 'mp-pay-rej-1', providerAccountId));
    assert.strictEqual(result.outcome, 'processed');

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'pending_payment', 'patient may retry while the hold lives');

    const updated = await app.service('appointment-payments').get(payment.id, { provider: undefined }) as any;
    assert.strictEqual(updated.status, 'rejected');
  });

  it('handles refunded and charged_back terminal statuses', async () => {
    const { payment, providerAccountId } = await bookPaid('wh-refund', 'optional');

    providerState.getChargeImpl = async () => approvedCharge(payment);
    await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-r-1', 'mp-pay-r-1', providerAccountId));

    providerState.getChargeImpl = async () => approvedCharge(payment, {
      status: 'refunded',
      refundedAmount: payment.amount,
    });
    await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-r-2', 'mp-pay-r-1', providerAccountId));

    let updated = await app.service('appointment-payments').get(payment.id, { provider: undefined }) as any;
    assert.strictEqual(updated.status, 'refunded');
    assert.strictEqual(updated.refundedAmount, payment.amount);
    assert.strictEqual(updated.refundStatus, 'completed');

    // Charged back (separate payment).
    const second = await bookPaid('wh-cb', 'optional');
    providerState.getChargeImpl = async () => approvedCharge(second.payment);
    await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-cb-1', 'mp-pay-cb-1', second.providerAccountId));
    providerState.getChargeImpl = async () => approvedCharge(second.payment, { status: 'charged_back' });
    await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-cb-2', 'mp-pay-cb-1', second.providerAccountId));

    updated = await app.service('appointment-payments').get(second.payment.id, { provider: undefined }) as any;
    assert.strictEqual(updated.status, 'charged_back');
    assert.strictEqual(updated.flagged, true);
  });

  it('resurrects an expired hold when the late payment arrives and the slot is free', async () => {
    const { booking, payment, providerAccountId } = await bookPaid('wh-late-free', 'required');

    await (app.service('appointments') as any).patch(booking.appointmentId, {
      status: 'expired',
    }, { provider: undefined });

    providerState.getChargeImpl = async () => approvedCharge(payment);
    const result = await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-late-1', 'mp-pay-late-1', providerAccountId));
    assert.strictEqual(result.outcome, 'processed');

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'confirmed', 'patient keeps the slot they paid for');
  });

  it('flags and auto-refunds a late payment whose slot was retaken', async () => {
    const { org, medic, booking, payment, providerAccountId } = await bookPaid('wh-late-lost', 'required');

    // Hold expires, another patient takes the slot.
    await (app.service('appointments') as any).patch(booking.appointmentId, {
      status: 'expired',
      holdExpiresAt: new Date(Date.now() - 60_000),
    }, { provider: undefined });
    const rival = await createTestPatient('wh-late-lost-rival');
    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    const rebook = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date(appointment.startDate).toISOString() },
      asPatient(rival.id, org.id)
    ) as any;
    assert.strictEqual(rebook.ok, true);

    providerState.getChargeImpl = async () => approvedCharge(payment);
    const result = await processPaymentEvent(app, 'mercado_pago', paymentEvent('evt-late-2', 'mp-pay-late-2', providerAccountId));
    assert.strictEqual(result.outcome, 'flagged');

    const original = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(original.status, 'expired', 'the double-booked slot is never silently confirmed');

    const updated = await app.service('appointment-payments').get(payment.id, { provider: undefined }) as any;
    assert.strictEqual(updated.flagged, true);
    assert.strictEqual(updated.flagReason, 'late_payment_slot_retaken');
    assert.strictEqual(updated.refundStatus, 'requested');
    assert.deepStrictEqual(providerState.refundCalls, ['mp-pay-late-2'], 'automatic refund attempted');
  });
});
