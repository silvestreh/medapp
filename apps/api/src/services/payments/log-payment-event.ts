import type { Application, AppointmentPayment } from '../../declarations';

// Best-effort audit trail entry for a payment lifecycle event. Fire-and-forget
// on purpose: an access-log failure must never break a booking or a webhook.
export function logPaymentEvent(
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
  }, { provider: undefined }).catch(() => undefined);
}
