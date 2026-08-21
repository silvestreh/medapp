import { Hook, HookContext } from '@feathersjs/feathers';
import { sanitizeForLog } from '../utils/sanitize-for-log';

// App-level error hook: whatever a payment/OAuth failure carries, no token,
// client secret, or authorization code may survive into the serialized error,
// the logs, or Sentry. Runs first in error.all so downstream capture hooks
// only ever see the scrubbed error.
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-_.~+/=]+/g;

const redactPaymentSecrets = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const error = context.error as (Error & Record<string, any>) | undefined;

  if (!error) {
    return context;
  }

  if (typeof error.message === 'string' && BEARER_PATTERN.test(error.message)) {
    error.message = error.message.replace(BEARER_PATTERN, 'Bearer [REDACTED]');
  }

  if (error.data && typeof error.data === 'object') {
    error.data = sanitizeForLog(error.data);
  }

  if (error.mercadoPagoContext && typeof error.mercadoPagoContext === 'object') {
    error.mercadoPagoContext = sanitizeForLog(error.mercadoPagoContext);
  }

  return context;
};

export default redactPaymentSecrets;
