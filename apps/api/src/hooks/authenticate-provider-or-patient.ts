import { Hook, HookContext } from '@feathersjs/feathers';
import { NotAuthenticated } from '@feathersjs/errors';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

/**
 * Tries provider JWT auth first, then falls back to patient token auth.
 * Sets context.params.patient for patient tokens, context.params.user for provider tokens.
 */
const authenticateProviderOrPatient = (patientAudiences: string[]): Hook => async (context: HookContext): Promise<HookContext> => {
  // Try standard JWT auth (provider) first
  try {
    await authenticate('jwt')(context);
    return context;
  } catch {
    // Fall through to patient auth
  }

  // Try patient token with each audience
  const authHeader = context.params.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new NotAuthenticated('Authentication required');
  }

  const token = authHeader.slice(7);
  const authService = context.app.service('authentication');

  for (const audience of patientAudiences) {
    try {
      const payload = await (authService as any).verifyAccessToken(token, { audience });

      if (payload.type !== 'patient') {
        continue;
      }

      context.params.patient = { id: payload.sub, organizationId: payload.organizationId };
      context.params.authenticated = true;
      return context;
    } catch {
      // Try next audience
    }
  }

  throw new NotAuthenticated('Invalid or expired token');
};

export default authenticateProviderOrPatient;
