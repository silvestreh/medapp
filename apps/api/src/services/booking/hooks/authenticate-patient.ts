import { Hook, HookContext } from '@feathersjs/feathers';
import { NotAuthenticated } from '@feathersjs/errors';

const authenticatePatient = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const authHeader = context.params.headers?.authorization;
  const config = context.app.get('patientAuthentication');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new NotAuthenticated('Authentication required');
  }

  const token = authHeader.slice(7);
  const authService = context.app.service('authentication');

  try {
    const payload = await (authService as any).verifyAccessToken(token, {
      audience: config.audience,
    });

    if (payload.type !== 'patient') {
      throw new NotAuthenticated('Invalid token type');
    }

    context.params.patient = { id: payload.sub, organizationId: payload.organizationId };
  } catch (error: any) {
    if (error instanceof NotAuthenticated) throw error;
    throw new NotAuthenticated('Invalid or expired token');
  }

  return context;
};

export default authenticatePatient;
