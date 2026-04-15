import { Hook, HookContext } from '@feathersjs/feathers';
import Sentry from '../sentry';
import type { RecetarioErrorContext } from '../services/recetario/recetario-client';

/**
 * Captures unexpected errors in Sentry. Skips expected errors:
 * - 401 (authentication failures)
 * - Legacy 404s (string IDs longer than 36 chars)
 * - access-logs service errors
 * - patient-otp 400s (scanner garbage)
 */
export const captureSentryError = (): Hook => {
  return (context: HookContext): HookContext => {
    if (!context.error) return context;

    const isLegacyNotFound =
      context.error.code === 404 &&
      typeof context.id === 'string' &&
      context.id.length > 36;

    const isAccessLogError = context.path === 'access-logs';
    const isPatientOtpBadRequest = context.path === 'patient-otp' && context.error.code === 400;
    const isExpectedError = context.error.code === 401 || isLegacyNotFound || isAccessLogError || isPatientOtpBadRequest;

    if (!isExpectedError) {
      const recetarioContext: RecetarioErrorContext | undefined = context.error.recetarioContext;

      Sentry.withScope((scope) => {
        if (context.params.user) {
          scope.setUser({ id: context.params.user.id, email: context.params.user.email });
        }

        if (recetarioContext) {
          scope.setContext('recetario', {
            calledBy: context.params.user?.email || context.params.user?.id || 'unknown',
            method: recetarioContext.method,
            url: recetarioContext.url,
            requestPayload: recetarioContext.requestPayload,
            responseStatus: recetarioContext.responseStatus,
            responseBody: recetarioContext.responseBody,
          });
        }

        Sentry.captureException(context.error);
      });
    }

    return context;
  };
};
