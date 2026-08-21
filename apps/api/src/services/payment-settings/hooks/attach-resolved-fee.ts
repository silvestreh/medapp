import { Hook, HookContext } from '@feathersjs/feathers';
import type { Application } from '../../../declarations';
import { resolveAmount } from '../../payments/amount-resolver';

// Attaches the server-resolved consultation fee (from
// accounting_settings.insurerPrices._particular.encounter) to each returned
// settings row, so the professional's UI can display the price read-only
// without needing direct accounting-settings read permissions. Display-only:
// booking always re-resolves and snapshots at charge time.
const attachResolvedFee = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { result } = context;

  if (!result) {
    return context;
  }

  const rows: any[] = Array.isArray(result)
    ? result
    : Array.isArray(result.data)
      ? result.data
      : [result];

  await Promise.all(rows.map(async (row) => {
    if (!row || !row.userId || !row.organizationId) {
      return;
    }

    try {
      const resolved = await resolveAmount('private_fee', {
        app: context.app as unknown as Application,
        medicId: String(row.userId),
        organizationId: String(row.organizationId),
        chargePortion: row.chargePortion ?? 100,
      });

      row.resolvedFee = resolved && {
        amount: resolved.amount,
        feeMinor: resolved.feeMinor,
        currency: resolved.currency,
        chargePortion: resolved.chargePortion,
      };
    } catch {
      row.resolvedFee = null;
    }
  }));

  return context;
};

export default attachResolvedFee;
