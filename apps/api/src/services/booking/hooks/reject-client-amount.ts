import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

// The charge amount is computed server-side from stored configuration, full
// stop. Any client-supplied amount-shaped field is treated as an attack and
// rejected outright (the booking class re-checks; this hook is the outer
// wall).
const FORBIDDEN_FIELDS = [
  'amount',
  'amountMinor',
  'fee',
  'feeMinor',
  'price',
  'currency',
  'chargePortion',
  'payment',
];

const rejectClientAmount = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const data = context.data ?? {};

  for (const field of FORBIDDEN_FIELDS) {
    if (field in data) {
      throw new BadRequest('Payment amounts are computed server-side');
    }
  }

  return context;
};

export default rejectClientAmount;
