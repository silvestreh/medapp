import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

const CHARGE_PORTIONS = [25, 50, 100];
const REQUIREMENT_MODES = ['optional', 'required'];
const HOLD_WINDOW_MIN = 5;
const HOLD_WINDOW_MAX = 120;

// userId/organizationId are injected by checkPermissions({ foreignKey }) and
// org scoping; everything else the client may send is validated strictly and
// unknown fields are rejected — there is no legitimate extra field here, and
// the fee itself deliberately does NOT live on this record (it comes from
// accounting_settings.insurerPrices._particular.encounter).
const ALLOWED_FIELDS = new Set([
  'userId',
  'organizationId',
  'enabled',
  'chargePortion',
  'requirementMode',
  'holdWindowMinutes',
]);

const validatePaymentSettings = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const data = context.data ?? {};

  for (const field of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(field)) {
      throw new BadRequest(`Unknown field: ${field}`);
    }
  }

  if ('enabled' in data && typeof data.enabled !== 'boolean') {
    throw new BadRequest('enabled must be a boolean');
  }

  if ('chargePortion' in data && !CHARGE_PORTIONS.includes(data.chargePortion)) {
    throw new BadRequest('chargePortion must be one of 25, 50, 100');
  }

  if ('requirementMode' in data && !REQUIREMENT_MODES.includes(data.requirementMode)) {
    throw new BadRequest('requirementMode must be optional or required');
  }

  if ('holdWindowMinutes' in data) {
    const hold = data.holdWindowMinutes;

    if (!Number.isInteger(hold) || hold < HOLD_WINDOW_MIN || hold > HOLD_WINDOW_MAX) {
      throw new BadRequest(`holdWindowMinutes must be an integer between ${HOLD_WINDOW_MIN} and ${HOLD_WINDOW_MAX}`);
    }
  }

  return context;
};

export default validatePaymentSettings;
