import type { Application } from '../../declarations';
import {
  PARTICULAR_INSURER_ID,
  resolveTotalCost,
  toInsurerPrices,
} from '../../utils/cost-resolution';

// "What is owed" is a pluggable step so Phase 2 (insurer-derived coseguro) is
// a new resolver file plus a registry entry, never a booking-path rewrite.
// Phase 1 ships only 'private_fee': the professional's own consultation fee,
// read from accounting_settings.insurerPrices['_particular']['encounter'].
// The amount is ALWAYS computed server-side from stored configuration — no
// resolver may ever accept a client-supplied amount.

export interface ResolvedAmount {
  resolverId: string;
  // The charged amount in integer minor units (centavos), after the portion.
  amount: number;
  currency: string;
  // Snapshots of the inputs, so the payment record can justify the amount
  // even after the professional later changes their fee.
  feePesos: number;
  feeMinor: number;
  chargePortion: number;
}

export interface AmountResolutionContext {
  app: Application;
  medicId: string;
  organizationId: string;
  chargePortion: number;
}

type AmountResolverFn = (context: AmountResolutionContext) => Promise<ResolvedAmount | null>;

export const pesosToMinorUnits = (pesos: number): number => Math.round(pesos * 100);

const privateFeeResolver: AmountResolverFn = async ({ app, medicId, organizationId, chargePortion }) => {
  const result = await app.service('accounting-settings').find({
    query: { userId: medicId, organizationId, $limit: 1 },
    provider: undefined,
  }) as any;
  const settings = (result.data || result)[0];

  if (!settings) {
    return null;
  }

  const insurerPricing = toInsurerPrices(settings.insurerPrices)[PARTICULAR_INSURER_ID];
  const feePesos = resolveTotalCost({
    insurerPricing,
    practiceType: 'encounter',
    emergency: false,
    activeSections: [],
    tierName: null,
  });

  if (!(feePesos > 0)) {
    return null;
  }

  const feeMinor = pesosToMinorUnits(feePesos);
  const amount = Math.round((feeMinor * chargePortion) / 100);

  if (!(amount > 0)) {
    return null;
  }

  return {
    resolverId: 'private_fee',
    amount,
    currency: 'ARS',
    feePesos,
    feeMinor,
    chargePortion,
  };
};

const resolvers = new Map<string, AmountResolverFn>([
  ['private_fee', privateFeeResolver],
]);

// Returns null when the professional has no usable price configured — callers
// must degrade to the normal unpaid booking path, never break the booking.
export async function resolveAmount(
  resolverId: string,
  context: AmountResolutionContext
): Promise<ResolvedAmount | null> {
  const resolver = resolvers.get(resolverId);

  if (!resolver) {
    throw new Error(`Unknown amount resolver: ${resolverId}`);
  }

  return resolver(context);
}
