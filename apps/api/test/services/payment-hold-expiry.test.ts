import assert from 'assert';
import { QueryTypes, Sequelize } from 'sequelize';
import app from '../../src/app';
import { asPatient, createTestPatient, makeChargeProvider, setupPaidMedic } from '../payment-test-helpers';
import { setProviderForTesting, resetProvidersForTesting } from '../../src/services/payments/provider-registry';
import { runPaymentHoldExpiry } from '../../src/cron/payment-hold-expiry';

describe('payment hold expiry', function () {
  this.timeout(30000);

  beforeEach(() => {
    setProviderForTesting('mercado_pago', makeChargeProvider().provider);
  });

  after(() => {
    resetProvidersForTesting();
  });

  const lapseHold = async (appointmentId: string, minutesAgo = 1) => {
    await (app.service('appointments') as any).patch(appointmentId, {
      holdExpiresAt: new Date(Date.now() - minutesAgo * 60_000),
    }, { provider: undefined });
    await app.service('appointment-payments').patch(null, {
      expiresAt: new Date(Date.now() - minutesAgo * 60_000),
    }, {
      query: { appointmentId },
      provider: undefined,
    });
  };

  it('releases lapsed holds and expires their payments', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'exp-job', mode: 'required' });
    const patient = await createTestPatient('exp-job');
    const startDate = new Date('2032-01-05T13:00:00Z').toISOString();

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;

    await lapseHold(booking.appointmentId);
    await runPaymentHoldExpiry(app);

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'expired');

    const payment = await app.service('appointment-payments').get(booking.payment.paymentId, { provider: undefined }) as any;
    assert.strictEqual(payment.status, 'expired');

    // The slot is free again for the patient-facing grid.
    const slots = await app.service('booking').find({
      query: { intent: 'find-appointments', medicId: medic.id, date: '2032-01-05' },
      ...asPatient(patient.id, org.id),
    }) as any[];
    const slot = slots.find((s: any) => new Date(s.date).getTime() === new Date(startDate).getTime());
    if (slot) {
      assert.strictEqual(slot.taken, false);
    }

    const other = await createTestPatient('exp-job-2');
    const rebook = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(other.id, org.id)
    ) as any;
    assert.strictEqual(rebook.ok, true);
  });

  it('frees a lapsed hold at booking time even before the job runs', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'exp-read', mode: 'required' });
    const patient = await createTestPatient('exp-read');
    const startDate = new Date('2032-01-06T13:00:00Z').toISOString();

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;
    await lapseHold(booking.appointmentId);

    // No cron run: create() itself expires the stale hold inside its txn.
    const other = await createTestPatient('exp-read-2');
    const rebook = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(other.id, org.id)
    ) as any;
    assert.strictEqual(rebook.ok, true);

    const stale = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(stale.status, 'expired');
  });

  it('expires stale optional-mode payment offers without touching the appointment', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'exp-opt', mode: 'optional' });
    const patient = await createTestPatient('exp-opt');

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2032-01-07T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    await app.service('appointment-payments').patch(booking.payment.paymentId, {
      expiresAt: new Date(Date.now() - 60_000),
    }, { provider: undefined });

    await runPaymentHoldExpiry(app);

    const appointment = await app.service('appointments').get(booking.appointmentId, { provider: undefined }) as any;
    assert.strictEqual(appointment.status, 'confirmed', 'optional booking stays confirmed');

    const payment = await app.service('appointment-payments').get(booking.payment.paymentId, { provider: undefined }) as any;
    assert.strictEqual(payment.status, 'expired');
  });

  it('deletes long-expired hold rows but keeps the payment record', async () => {
    const { org, medic } = await setupPaidMedic({ tag: 'exp-purge', mode: 'required' });
    const patient = await createTestPatient('exp-purge');

    const booking = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2032-01-08T13:00:00Z').toISOString() },
      asPatient(patient.id, org.id)
    ) as any;

    await lapseHold(booking.appointmentId, 25 * 60);
    await runPaymentHoldExpiry(app);

    await assert.rejects(app.service('appointments').get(booking.appointmentId, { provider: undefined }));

    const payment = await app.service('appointment-payments').get(booking.payment.paymentId, { provider: undefined }) as any;
    assert.strictEqual(payment.appointmentId, null);
    assert.strictEqual(String(payment.medicId), String(medic.id));
    assert.ok(payment.appointmentStartDate, 'snapshot survives the appointment row');
  });

  it('purges stale OAuth states', async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');
    const stateModel: any = sequelize.models.payment_oauth_states;
    const { medic } = await setupPaidMedic({ tag: 'exp-oauth', connected: false });

    await stateModel.create({
      state: `stale-state-${Date.now()}`,
      userId: medic.id,
      provider: 'mercado_pago',
      codeVerifier: 'verifier',
      expiresAt: new Date(Date.now() - 2 * 3600_000),
    });

    await runPaymentHoldExpiry(app);

    const rows = await sequelize.query(
      'SELECT state FROM "payment_oauth_states" WHERE "userId" = :userId',
      { replacements: { userId: medic.id }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(rows.length, 0);
  });
});
