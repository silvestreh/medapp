import assert from 'assert';
import { QueryTypes, Sequelize } from 'sequelize';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { asPatient, createTestPatient, makeChargeProvider, setupPaidMedic } from '../payment-test-helpers';
import { setProviderForTesting, resetProvidersForTesting } from '../../src/services/payments/provider-registry';

describe('\'booking\' service with payments', function () {
  this.timeout(30000);

  let providerState: ReturnType<typeof makeChargeProvider>['state'];

  beforeEach(() => {
    const { provider, state } = makeChargeProvider();
    providerState = state;
    setProviderForTesting('mercado_pago', provider);
  });

  after(() => {
    resetProvidersForTesting();
  });

  it('REGRESSION: a professional without payment config books exactly as before', async () => {
    const org = await createTestOrganization({ slug: `no-pay-${Date.now().toString(36)}` });
    const medic = await createTestUser({
      username: `no.pay.${Date.now().toString(36)}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    const patient = await createTestPatient('regression');

    const result = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-03-02T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    assert.deepStrictEqual(Object.keys(result).sort(), ['appointmentId', 'ok']);
    assert.strictEqual(result.ok, true);

    const sequelize: Sequelize = app.get('sequelizeClient');
    const rows = await sequelize.query(
      'SELECT id FROM "appointment_payments" WHERE "appointmentId" = :id',
      { replacements: { id: result.appointmentId }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(rows.length, 0, 'no payment tables touched');
    assert.strictEqual(providerState.chargeCalls.length, 0, 'provider never contacted');
  });

  it('optional mode: confirms immediately and offers a checkout alongside', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'opt', mode: 'optional', chargePortion: 50, priceInPesos: 5000 });
    const patient = await createTestPatient('opt');
    const startDate = new Date('2030-03-03T13:00:00Z').toISOString();

    const result = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;

    assert.strictEqual(result.ok, true);
    assert.ok(result.payment, 'payment block expected');
    assert.strictEqual(result.payment.amount, 250000);
    assert.strictEqual(result.payment.feeMinor, 500000);
    assert.strictEqual(result.payment.remainderAmount, 250000);
    assert.strictEqual(result.payment.isDeposit, true);
    assert.strictEqual(result.payment.requirementMode, 'optional');
    assert.match(result.payment.checkoutUrl, /^https:\/\/fake\.mp\/checkout\//);

    const appointment = await app.service('appointments').get(result.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'confirmed', 'optional mode never holds');
    assert.strictEqual(appointment.holdExpiresAt, null);

    // Provider payload carries no patient PII: generic title, opaque reference.
    const charge = providerState.chargeCalls[0];
    assert.strictEqual(charge.title, 'Consulta médica');
    assert.strictEqual(charge.idempotencyKey, `mercado_pago:${result.appointmentId}`);
    assert.ok(!JSON.stringify(charge).includes(String(patient.id)));
    assert.match(charge.backUrls.success, new RegExp(`/appointment/${result.appointmentId}/payment$`));
  });

  it('required mode: holds the slot as pending_payment with an expiry', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'req', mode: 'required', holdWindowMinutes: 30 });
    const patient = await createTestPatient('req');

    const result = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-03-04T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    assert.strictEqual(result.payment.requirementMode, 'required');

    const appointment = await app.service('appointments').get(result.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'pending_payment');
    assert.ok(appointment.holdExpiresAt);
    const holdMs = new Date(appointment.holdExpiresAt).getTime() - Date.now();
    assert.ok(holdMs > 25 * 60 * 1000 && holdMs <= 30 * 60 * 1000, 'hold window respected');
  });

  it('rejects any client-supplied amount as an attack', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'attack' });
    const patient = await createTestPatient('attack');
    const startDate = new Date('2030-03-05T13:00:00Z').toISOString();

    for (const payload of [{ amount: 1 }, { feeMinor: 1 }, { currency: 'USD' }, { payment: { amount: 1 } }, { chargePortion: 25 }]) {
      await assert.rejects(
        app.service('booking').create({ medicId: medic.id, startDate, ...payload }, asPatient(patient.id, org.id)),
        /computed server-side/
      );
    }
  });

  it('optional mode degrades to an unpaid confirmed booking when the provider is down', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'down-opt', mode: 'optional' });
    const patient = await createTestPatient('down-opt');
    providerState.chargeImpl = async () => {
      throw new Error('MercadoPago: unreachable');
    };

    const result = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-03-06T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.paymentUnavailable, true);
    assert.strictEqual(result.payment, undefined);

    const appointment = await app.service('appointments').get(result.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'confirmed');
  });

  it('required mode releases the slot when the provider is down', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'down-req', mode: 'required' });
    const patient = await createTestPatient('down-req');
    const startDate = new Date('2030-03-07T13:00:00Z').toISOString();
    providerState.chargeImpl = async () => {
      throw new Error('MercadoPago: unreachable');
    };

    await assert.rejects(
      app.service('booking').create({ medicId: medic.id, startDate }, asPatient(patient.id, org.id)),
      /payment_provider_unavailable/
    );

    // The slot must be immediately rebookable.
    const { provider: healthyProvider } = makeChargeProvider();
    setProviderForTesting('mercado_pago', healthyProvider);
    const other = await createTestPatient('down-req-2');
    const retry = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(other.id, org.id)
    ) as any;
    assert.strictEqual(retry.ok, true);
  });

  it('degrades to unpaid when the connection is not connected', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'no-conn', connected: false });
    const patient = await createTestPatient('no-conn');

    const result = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-03-08T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    assert.deepStrictEqual(Object.keys(result).sort(), ['appointmentId', 'ok']);
  });

  it('find-medics exposes the payment block only for effectively-enabled medics', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'medics', mode: 'required', chargePortion: 25, priceInPesos: 1000 });
    const plainMedic = await createTestUser({
      username: `plain.medic.${Date.now().toString(36)}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    // findMedics only lists medics whose md_settings mark them verified.
    for (const userId of [medic.id, plainMedic.id]) {
      await app.service('md-settings').create({
        userId,
        isVerified: true,
        encounterDuration: 20,
      }, { provider: undefined });
    }

    const patient = await createTestPatient('medics');
    const medics = await app.service('booking').find({
      query: { intent: 'find-medics' },
      ...asPatient(patient.id, org.id),
    }) as any[];

    const enriched = medics.find((m: any) => m.id === medic.id);
    const plain = medics.find((m: any) => m.id === plainMedic.id);

    if (enriched) {
      assert.deepStrictEqual(enriched.payment, {
        amount: 25000,
        currency: 'ARS',
        feeMinor: 100000,
        chargePortion: 25,
        requirementMode: 'required',
      });
    }
    if (plain) {
      assert.strictEqual(plain.payment, undefined);
    }
    assert.ok(enriched, 'paid medic should be listed');
  });

  it('skip-payment cancels the open offer in optional mode and is refused in required mode', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'skip', mode: 'optional' });
    const patient = await createTestPatient('skip');

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-03-09T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    const skip = await (app.service('booking') as any).patch(
      booking.appointmentId,
      { action: 'skip-payment' },
      asPatient(patient.id, org.id)
    );
    assert.strictEqual(skip.ok, true);

    const paymentsResult = await app.service('appointment-payments').find({
      query: { appointmentId: booking.appointmentId },
      provider: undefined,
    }) as any;
    assert.strictEqual((paymentsResult.data || paymentsResult)[0].status, 'cancelled');

    // Required mode cannot skip.
    const required = await setupPaidMedic({ tag: 'skip-req', mode: 'required' });
    const patient2 = await createTestPatient('skip-req');
    const booking2 = await app.service('booking').create(
      { medicId: required.medic.id, startDate: new Date('2030-03-09T14:00:00Z').toISOString() },
      asPatient(patient2.id, required.org.id)
    ) as any;

    await assert.rejects(
      (app.service('booking') as any).patch(
        booking2.appointmentId,
        { action: 'skip-payment' },
        asPatient(patient2.id, required.org.id)
      ),
      /Payment is required/
    );
  });

  it('get-payment-status reflects the truth and enforces expiry at read time', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'status', mode: 'required' });
    const patient = await createTestPatient('status');
    const startDate = new Date('2030-03-10T13:00:00Z').toISOString();

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;

    const pending = await app.service('booking').find({
      query: { intent: 'get-payment-status', appointmentId: booking.appointmentId },
      ...asPatient(patient.id, org.id),
    }) as any;
    assert.strictEqual(pending.appointmentStatus, 'pending_payment');
    assert.strictEqual(pending.payment.status, 'pending');
    assert.ok(pending.payment.checkoutUrl);

    // Lapse the hold; the read must expire it without waiting for the cron.
    await (app.service('appointments') as any).patch(booking.appointmentId, {
      holdExpiresAt: new Date(Date.now() - 60_000),
    }, { provider: undefined });

    const expired = await app.service('booking').find({
      query: { intent: 'get-payment-status', appointmentId: booking.appointmentId },
      ...asPatient(patient.id, org.id),
    }) as any;
    assert.strictEqual(expired.appointmentStatus, 'expired');
    assert.strictEqual(expired.payment.status, 'expired');

    // And the slot is rebookable.
    const other = await createTestPatient('status-2');
    const rebook = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(other.id, org.id)
    ) as any;
    assert.strictEqual(rebook.ok, true);

    // Another patient cannot read this appointment's payment status.
    await assert.rejects(
      app.service('booking').find({
        query: { intent: 'get-payment-status', appointmentId: booking.appointmentId },
        ...asPatient(other.id, org.id),
      }),
      /not found/
    );
  });

  it('patient cancellation keeps the financial trail and flags paid deposits', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'cancel', mode: 'optional', chargePortion: 50 });
    const patient = await createTestPatient('cancel');

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-03-11T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    // Simulate an approved deposit before the cancellation.
    await app.service('appointment-payments').patch(booking.payment.paymentId, {
      status: 'approved',
      paidAt: new Date(),
    }, { provider: undefined });

    await app.service('booking').remove(booking.appointmentId, asPatient(patient.id, org.id));

    const payment = await app.service('appointment-payments').get(booking.payment.paymentId, { provider: undefined }) as any;
    assert.strictEqual(payment.status, 'approved', 'deposit retained per policy');
    assert.strictEqual(payment.flagged, true);
    assert.strictEqual(payment.flagReason, 'patient_cancelled');
    assert.strictEqual(payment.appointmentId, null, 'FK nulled, snapshot survives');
    assert.strictEqual(String(payment.medicId), String(medic.id));
  });
});
