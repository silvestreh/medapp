import type { PaymentStatus } from './domain';

// Payment status is monotonic: webhook processing always applies the status of
// the authoritative fetched record through this guard, so duplicate and
// out-of-order deliveries collapse to no-ops instead of regressing state.
// (Appointment status is driven directly by the booking/webhook code under the
// per-slot lock; see process-payment-event.ts.)
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['in_process', 'approved', 'rejected', 'cancelled', 'expired'],
  // Checkout sessions allow retried attempts, so a rejection is not terminal
  // while the checkout is still open.
  in_process: ['approved', 'rejected', 'cancelled', 'expired'],
  rejected: ['in_process', 'approved', 'cancelled', 'expired'],
  // Late-webhook path: a payment that expired locally can still be approved
  // upstream (resurrect-or-refund policy decides what happens next).
  expired: ['approved'],
  approved: ['refunded', 'charged_back'],
  cancelled: [],
  refunded: [],
  charged_back: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}
