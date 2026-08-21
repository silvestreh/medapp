import dayjs from 'dayjs';
import type { Sequelize } from 'sequelize';
import type { Application, AppointmentPayment } from '../../declarations';
import type { ProviderCredentials, ProviderEvent } from './domain';
import { getProvider } from './provider-registry';
import { canTransitionPayment } from './payment-state-machine';
import { withSlotLock } from './slot-lock';
import { logPaymentEvent } from './log-payment-event';
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

  // Credentials come from the known payment's professional, or — on first
  // contact — from whoever owns the provider account the notification names.
  const credentials = payment
    ? await connections.getDecryptedCredentials(String(payment.medicId))
    : event.providerAccountId
      ? await connections.getDecryptedCredentialsByAccount(providerId, event.providerAccountId)
      : null;

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
    const result = await applyApproved(app, sequelize, payment, credentials);
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
  payment: AppointmentPayment,
  credentials: ProviderCredentials
): Promise<ProcessOutcome> {
  const paymentsService = app.service('appointment-payments');
  const appointmentsService = app.service('appointments');

  const outcome = await withSlotLock(
    sequelize,
    String(payment.medicId),
    payment.appointmentStartDate,
    async (transaction) => {
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

      // A late webhook for an expired hold still wins the slot when no OTHER
      // active row has taken the same time since.
      const slotStillFree = async (): Promise<boolean> => {
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

        return ((conflicting.data || conflicting) as any[]).length === 0;
      };

      const needsConfirm = appointment?.status === 'pending_payment'
        || (appointment?.status === 'expired' && await slotStillFree());
      // Optional mode: the booking was already confirmed; just record the payment.
      const alreadyConfirmed = appointment?.status === 'confirmed';

      if (needsConfirm || alreadyConfirmed) {
        await appointmentsService.patch(
          appointment.id,
          { paidAt: now, ...(needsConfirm && { status: 'confirmed' }) },
          txParams
        );
        await paymentsService.patch(payment.id, { status: 'approved', paidAt: now }, txParams);
        return needsConfirm ? 'confirmed' : 'recorded';
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
    }
  );

  if (outcome === 'confirmed' || outcome === 'recorded') {
    logPaymentEvent(app, payment, 'approved', 'grant');
    return { outcome: 'processed' };
  }

  // slot_lost: attempt the automatic refund with the professional's own
  // credentials; the resulting state reconciles via the refund webhook.
  logPaymentEvent(app, payment, 'late_payment_slot_retaken', 'deny');

  try {
    if (payment.providerPaymentId) {
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
