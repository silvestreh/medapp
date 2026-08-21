import dayjs from 'dayjs';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import type { Application, AppointmentPayment } from '../../declarations';
import type { ProviderEvent } from './domain';
import { getProvider } from './provider-registry';
import { canTransitionPayment } from './payment-state-machine';
import type { PaymentConnections } from '../payment-connections/payment-connections.class';
import logger from '../../logger';

// Provider-agnostic webhook processing. Core rules:
// - NEVER trust the notification payload: the authoritative status and amount
//   come from re-fetching the payment with the professional's credentials.
// - The snapshotted amount must match exactly, or the payment is flagged and
//   the appointment is NOT confirmed.
// - Status moves only through the monotonic state machine, so duplicates and
//   out-of-order deliveries collapse to no-ops.
// - Appointment transitions happen under the same per-slot advisory lock the
//   booking path uses, serializing against expiry and rebooking.

export interface ProcessOutcome {
  outcome: 'processed' | 'ignored' | 'flagged' | 'noop' | 'error';
  appointmentPaymentId?: string;
}

const internal = { provider: undefined } as const;

const bookingLockKey = (medicId: string, startDate: Date | string): string =>
  `booking:${medicId}:${dayjs(startDate).toISOString()}`;

async function withSlotLock<T>(
  sequelize: Sequelize,
  lockKey: string,
  fn: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:lockKey))', {
      replacements: { lockKey },
      type: QueryTypes.SELECT,
      transaction,
    });

    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

function logPaymentEvent(
  app: Application,
  payment: AppointmentPayment,
  event: string,
  action: 'write' | 'grant' | 'deny' = 'write'
): void {
  app.service('access-logs').create({
    userId: payment.medicId,
    organizationId: payment.organizationId,
    resource: 'payment',
    action,
    purpose: 'billing',
    patientId: payment.patientId,
    metadata: { event, appointmentPaymentId: payment.id },
  }, internal).catch(() => undefined);
}

async function notifyFlaggedPayment(
  app: Application,
  payment: AppointmentPayment,
  reason: 'late_payment_slot_retaken' | 'amount_mismatch' | 'charged_back'
): Promise<void> {
  try {
    const medic = await app.service('users').get(payment.medicId, internal) as any;
    const to = medic?.username;

    if (!to || !to.includes('@')) {
      return;
    }

    const amountFormatted = `${payment.currency} ${(payment.amount / 100).toFixed(2)}`;
    await app.service('mailer').create({
      template: 'payment-flagged',
      to,
      subject: 'Athelas: un pago de turno necesita tu atención',
      data: {
        medicName: medic?.personalData?.firstName ?? 'profesional',
        reason,
        appointmentDate: dayjs(payment.appointmentStartDate).format('DD/MM/YYYY HH:mm'),
        amountFormatted,
      },
    });
  } catch (error: any) {
    logger.warn('Payment flag notification failed: %s', error?.message);
  }
}

export async function processPaymentEvent(
  app: Application,
  providerId: string,
  event: ProviderEvent
): Promise<ProcessOutcome> {
  if (event.kind !== 'payment' || !event.providerPaymentId) {
    return { outcome: 'ignored' };
  }

  const sequelize: Sequelize = app.get('sequelizeClient');
  const paymentsService = app.service('appointment-payments');
  const connections = app.service('payment-connections') as unknown as PaymentConnections;

  // Locate the local payment row: by provider payment id if we've seen this
  // payment before, else via the authoritative fetch's external_reference.
  const byProviderId = await paymentsService.find({
    query: { providerPaymentId: event.providerPaymentId, $limit: 1 },
    ...internal,
  }) as any;
  let payment: AppointmentPayment | undefined = (byProviderId.data || byProviderId)[0];

  let credentials = payment
    ? await connections.getDecryptedCredentials(String(payment.medicId))
    : null;

  if (!payment && event.providerAccountId) {
    const [row] = await sequelize.query(
      'SELECT "userId" FROM "payment_connections" WHERE "providerAccountId" = :accountId LIMIT 1',
      { replacements: { accountId: event.providerAccountId }, type: QueryTypes.SELECT }
    ) as Array<{ userId: string }>;

    if (row) {
      credentials = await connections.getDecryptedCredentials(row.userId);
    }
  }

  if (!credentials) {
    logger.warn('Payment webhook: no credentials to fetch payment %s', event.providerPaymentId);
    return { outcome: 'error' };
  }

  const charge = await getProvider(providerId).getCharge({
    credentials,
    providerPaymentId: event.providerPaymentId,
  });

  if (!payment && charge.externalReference) {
    try {
      payment = await paymentsService.get(charge.externalReference, internal) as AppointmentPayment;
    } catch {
      payment = undefined;
    }
  }

  if (!payment) {
    logger.warn('Payment webhook: unknown external reference for payment %s', event.providerPaymentId);
    return { outcome: 'ignored' };
  }

  if (!payment.providerPaymentId) {
    payment = await paymentsService.patch(payment.id, {
      providerPaymentId: event.providerPaymentId,
    }, internal) as AppointmentPayment;
  }

  // Amount reconciliation against the booking-time snapshot.
  if (
    charge.amount &&
    (charge.amount.amount !== payment.amount || charge.amount.currency !== payment.currency)
  ) {
    payment = await paymentsService.patch(payment.id, {
      flagged: true,
      flagReason: 'amount_mismatch',
    }, internal) as AppointmentPayment;
    logPaymentEvent(app, payment, 'amount_mismatch', 'deny');
    await notifyFlaggedPayment(app, payment, 'amount_mismatch');
    return { outcome: 'flagged', appointmentPaymentId: String(payment.id) };
  }

  const nextStatus = charge.status;

  if (nextStatus === payment.status || !canTransitionPayment(payment.status, nextStatus)) {
    return { outcome: 'noop', appointmentPaymentId: String(payment.id) };
  }

  if (nextStatus === 'approved') {
    const result = await applyApproved(app, sequelize, payment);
    return { ...result, appointmentPaymentId: String(payment.id) };
  }

  if (nextStatus === 'refunded') {
    await paymentsService.patch(payment.id, {
      status: 'refunded',
      refundedAmount: charge.refundedAmount ?? payment.amount,
      refundStatus: 'completed',
    }, internal);
    logPaymentEvent(app, payment, 'refunded');
    return { outcome: 'processed', appointmentPaymentId: String(payment.id) };
  }

  if (nextStatus === 'charged_back') {
    payment = await paymentsService.patch(payment.id, {
      status: 'charged_back',
      flagged: true,
      flagReason: 'charged_back',
    }, internal) as AppointmentPayment;
    logPaymentEvent(app, payment, 'charged_back', 'deny');
    await notifyFlaggedPayment(app, payment, 'charged_back');
    return { outcome: 'flagged', appointmentPaymentId: String(payment.id) };
  }

  await paymentsService.patch(payment.id, { status: nextStatus }, internal);
  return { outcome: 'processed', appointmentPaymentId: String(payment.id) };
}

async function applyApproved(
  app: Application,
  sequelize: Sequelize,
  payment: AppointmentPayment
): Promise<ProcessOutcome> {
  const paymentsService = app.service('appointment-payments');
  const appointmentsService = app.service('appointments');
  const lockKey = bookingLockKey(String(payment.medicId), payment.appointmentStartDate);

  const outcome = await withSlotLock(sequelize, lockKey, async (transaction) => {
    const txParams = { ...internal, sequelize: { transaction } };
    const now = new Date();

    let appointment: any = null;
    if (payment.appointmentId) {
      try {
        appointment = await appointmentsService.get(payment.appointmentId, txParams);
      } catch {
        appointment = null;
      }
    }

    const confirm = async () => {
      await appointmentsService.patch(appointment.id, { status: 'confirmed', paidAt: now }, txParams);
      await paymentsService.patch(payment.id, { status: 'approved', paidAt: now }, txParams);
      return 'confirmed';
    };

    if (appointment?.status === 'pending_payment') {
      return confirm();
    }

    if (appointment?.status === 'confirmed') {
      // Optional mode: the booking was already confirmed; record the payment.
      await appointmentsService.patch(appointment.id, { paidAt: now }, txParams);
      await paymentsService.patch(payment.id, { status: 'approved', paidAt: now }, txParams);
      return 'recorded';
    }

    if (appointment?.status === 'expired') {
      // Late webhook: is the slot still free? (Any OTHER active row at the
      // same time means it was retaken.)
      const conflicting = await appointmentsService.find({
        query: {
          medicId: payment.medicId,
          startDate: dayjs(appointment.startDate).toISOString(),
          status: { $in: ['pending_payment', 'confirmed'] },
          id: { $ne: appointment.id },
          $limit: 1,
        },
        ...txParams,
      }) as any;

      if (((conflicting.data || conflicting) as any[]).length === 0) {
        // Resurrect: the patient paid and the slot is still theirs.
        return confirm();
      }
    }

    // Slot retaken (or appointment row gone): record the approval but do NOT
    // confirm a double-booking — flag, start the refund path, notify.
    await paymentsService.patch(payment.id, {
      status: 'approved',
      paidAt: now,
      flagged: true,
      flagReason: 'late_payment_slot_retaken',
      refundStatus: 'requested',
    }, txParams);
    return 'slot_lost';
  });

  if (outcome === 'confirmed' || outcome === 'recorded') {
    logPaymentEvent(app, payment, 'approved', 'grant');
    return { outcome: 'processed' };
  }

  // slot_lost: attempt the automatic refund with the professional's own
  // credentials; the resulting state reconciles via the refund webhook.
  logPaymentEvent(app, payment, 'late_payment_slot_retaken', 'deny');

  try {
    const connections = app.service('payment-connections') as unknown as PaymentConnections;
    const credentials = await connections.getDecryptedCredentials(String(payment.medicId));

    if (credentials && payment.providerPaymentId) {
      await getProvider(payment.provider).refundCharge({
        credentials,
        providerPaymentId: payment.providerPaymentId,
      });
    }
  } catch (error: any) {
    logger.error('Automatic refund for late payment failed: %s', error?.message);
    await paymentsService.patch(payment.id, { refundStatus: 'failed' }, internal).catch(() => undefined);
  }

  await notifyFlaggedPayment(app, payment, 'late_payment_slot_retaken');
  return { outcome: 'flagged' };
}
