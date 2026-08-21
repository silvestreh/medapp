import type { Charge, PaymentStatus } from '../../domain';

// Mercado Pago payloads ↔ domain types. This file (plus the client and the
// provider) is the ONLY place Mercado Pago vocabulary is allowed.

export interface MpPaymentResponse {
  id: number | string;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  external_reference?: string | null;
}

// MP amounts are decimal pesos; the domain speaks integer minor units.
export const mpAmountToMinorUnits = (pesos: number): number => Math.round(pesos * 100);
export const minorUnitsToMpAmount = (minor: number): number => Math.round(minor) / 100;

const MP_STATUS_MAP: Record<string, PaymentStatus> = {
  approved: 'approved',
  pending: 'in_process',
  in_process: 'in_process',
  in_mediation: 'in_process',
  authorized: 'in_process',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'charged_back',
};

export function mapMpStatus(status: string): PaymentStatus {
  // Unknown statuses map to in_process: the reconciliation flow re-fetches, so
  // an unmapped state must never confirm or terminate a payment.
  return MP_STATUS_MAP[status] ?? 'in_process';
}

export function mapMpPaymentToCharge(payment: MpPaymentResponse): Charge {
  const refunded = payment.transaction_amount_refunded;

  return {
    providerChargeId: String(payment.id),
    checkoutUrl: null,
    status: mapMpStatus(payment.status),
    amount: {
      amount: mpAmountToMinorUnits(payment.transaction_amount),
      currency: payment.currency_id,
    },
    externalReference: payment.external_reference ?? null,
    refundedAmount: refunded ? mpAmountToMinorUnits(refunded) : null,
  };
}
