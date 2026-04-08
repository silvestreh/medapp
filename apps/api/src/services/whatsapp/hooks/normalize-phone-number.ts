import { Hook, HookContext } from '@feathersjs/feathers';
import { normalizePhone } from '../../../utils/normalize-ar-phone';

/**
 * Before hook for whatsapp.create that normalizes the `to` phone number
 * to the format Evolution API expects: country code + local digits (no "+").
 *
 * Uses libphonenumber-js for parsing/validation, defaulting to Argentina
 * when no country code is present.
 *
 * If the number can't be normalized, short-circuits with
 * { sent: false, reason: 'invalid-phone-number' }.
 */
const normalizePhoneNumber = (): Hook => {
  return async (context: HookContext) => {
    const { data } = context;
    if (!data?.to || !data?.organizationId) return context;

    const normalized = normalizePhone(data.to);
    if (!normalized) {
      context.result = { sent: false, reason: 'invalid-phone-number' };
      return context;
    }

    data.to = normalized;
    return context;
  };
};

export default normalizePhoneNumber;
