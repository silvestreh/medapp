import { Hook, HookContext } from '@feathersjs/feathers';
import { NotAuthenticated } from '@feathersjs/errors';

const authenticatePatient = (audiences: string | string[]): Hook => async (context: HookContext): Promise<HookContext> => {
  const authHeader = context.params.headers?.authorization;
  const audienceList = Array.isArray(audiences) ? audiences : [audiences];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new NotAuthenticated('Authentication required');
  }

  const token = authHeader.slice(7);
  const authService = context.app.service('authentication');

  let lastError: Error | null = null;

  for (const audience of audienceList) {
    try {
      const payload = await (authService as any).verifyAccessToken(token, { audience });

      if (payload.type !== 'patient') {
        continue;
      }

      context.params.patient = { id: payload.sub, organizationId: payload.organizationId };
      return context;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (lastError instanceof NotAuthenticated) throw lastError;
  throw new NotAuthenticated('Invalid or expired token');
};

export default authenticatePatient;
