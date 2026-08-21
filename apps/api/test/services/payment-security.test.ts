import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { asPatient, asProvider, createTestPatient, makeChargeProvider, setupPaidMedic } from '../payment-test-helpers';
import { setProviderForTesting, resetProvidersForTesting } from '../../src/services/payments/provider-registry';
import { scrubEventSecrets } from '../../src/sentry';
import redactPaymentSecrets from '../../src/hooks/redact-payment-secrets';
import { sanitizeForLog } from '../../src/utils/sanitize-for-log';

describe('payment security', function () {
  this.timeout(30000);

  beforeEach(() => {
    setProviderForTesting('mercado_pago', makeChargeProvider().provider);
  });

  after(() => {
    resetProvidersForTesting();
  });

  it('never leaks tokens through booking responses or payment-status reads', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'sec-leak', mode: 'required' });
    const patient = await createTestPatient('sec-leak');

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2033-01-05T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    assert.ok(!JSON.stringify(booking).includes('seller-token'));
    assert.ok(!JSON.stringify(booking).includes('seller-refresh'));

    const status = await app.service('booking').find({
      query: { intent: 'get-payment-status', appointmentId: booking.appointmentId },
      ...asPatient(patient.id, org.id),
    });
    assert.ok(!JSON.stringify(status).includes('seller-token'));
  });

  it('scopes appointment-payments to the owning medic and organization', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'sec-scope', mode: 'optional' });
    const patient = await createTestPatient('sec-scope');
    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2033-01-06T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    // The owner reads their own payment.
    const own = await app.service('appointment-payments').find({
      query: {},
      ...asProvider(medic, org.id),
    }) as any;
    const ownRows = own.data || own;
    assert.ok(ownRows.some((row: any) => String(row.id) === String(booking.payment.paymentId)));

    // Another medic in the SAME org sees nothing of it.
    const colleague = await createTestUser({
      username: `sec.scope.colleague.${Date.now().toString(36)}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    const colleagueRows = await app.service('appointment-payments').find({
      query: {},
      ...asProvider(colleague, org.id),
    }) as any;
    assert.ok(((colleagueRows.data || colleagueRows) as any[])
      .every((row: any) => String(row.id) !== String(booking.payment.paymentId)));
    await assert.rejects(
      app.service('appointment-payments').get(booking.payment.paymentId, asProvider(colleague, org.id)),
      /own records/
    );

    // A medic from ANOTHER org is denied.
    const orgB = await createTestOrganization({ slug: `sec-scope-b-${Date.now().toString(36)}` });
    const medicB = await createTestUser({
      username: `sec.scope.b.${Date.now().toString(36)}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgB.id,
    });
    await assert.rejects(
      app.service('appointment-payments').get(booking.payment.paymentId, asProvider(medicB, orgB.id)),
      /different organization|own records/
    );

    // External writes are blocked entirely.
    await assert.rejects(
      app.service('appointment-payments').patch(
        booking.payment.paymentId,
        { amount: 1 },
        asProvider(medic, org.id)
      )
    );
  });

  it('scrubs payment material from Sentry events', () => {
    const event: any = {
      request: { data: { access_token: 'tok-123', client_secret: 'sec-456', note: 'keep' } },
      extra: { refreshToken: 'ref-789' },
      exception: { values: [{ type: 'Error', value: 'request failed: Bearer abc.def.ghi' }] },
    };

    const scrubbed: any = scrubEventSecrets(event);

    assert.strictEqual(scrubbed.request.data.access_token, '[REDACTED]');
    assert.strictEqual(scrubbed.request.data.client_secret, '[REDACTED]');
    assert.strictEqual(scrubbed.request.data.note, 'keep');
    assert.strictEqual(scrubbed.extra.refreshToken, '[REDACTED]');
    assert.strictEqual(scrubbed.exception.values[0].value, 'request failed: Bearer [REDACTED]');
  });

  it('redacts secrets from Feathers error payloads via the app error hook', async () => {
    const error: any = new Error('MercadoPago call failed with Bearer super.secret.token');
    error.data = { access_token: 'tok-1', detail: 'x' };
    error.providerContext = { responseBody: { refresh_token: 'ref-1' } };

    const context: any = { error };
    await (redactPaymentSecrets() as any)(context);

    assert.ok(!context.error.message.includes('super.secret.token'));
    assert.strictEqual(context.error.data.access_token, '[REDACTED]');
    assert.strictEqual((context.error.providerContext.responseBody as any).refresh_token, '[REDACTED]');
  });

  it('sanitizeForLog covers OAuth/payment key names', () => {
    const sanitized: any = sanitizeForLog({
      access_token: 'a',
      refresh_token: 'b',
      client_secret: 'c',
      code_verifier: 'd',
      codeVerifier: 'e',
      clientSecret: 'f',
      safe: 'ok',
    });

    for (const key of ['access_token', 'refresh_token', 'client_secret', 'code_verifier', 'codeVerifier', 'clientSecret']) {
      assert.strictEqual(sanitized[key], '[REDACTED]');
    }
    assert.strictEqual(sanitized.safe, 'ok');
  });

  it('keeps the access-log hash chain valid with the new payment resource types', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'sec-chain', mode: 'optional' });
    const patient = await createTestPatient('sec-chain');

    // Produce payment access-log entries (charge_created) plus a connection
    // event in the same org chain.
    await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2033-01-07T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    );
    await app.service('access-logs').create({
      userId: medic.id,
      organizationId: org.id,
      resource: 'payment-connection',
      action: 'grant',
      purpose: 'billing',
      patientId: null,
      metadata: { event: 'connect' },
    }, { provider: undefined });

    // Access logging is fire-and-forget; give it a beat.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const verification = await app.service('access-log-chain-verification').find({
      query: { organizationId: org.id },
      provider: undefined,
    }) as any;

    assert.strictEqual(verification.valid, true, `chain broken at ${JSON.stringify(verification.brokenAt)}`);
    assert.ok(verification.totalLogs >= 1);
  });
});
