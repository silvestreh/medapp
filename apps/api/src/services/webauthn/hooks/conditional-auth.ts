import { Hook, HookContext } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

const conditionalAuth = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const action = context.data?.action;
  const publicActions = ['generate-authentication-options', 'verify-authentication'];

  if (publicActions.includes(action)) {
    return context;
  }

  const authHook = authenticate('jwt');
  return authHook(context);
};

export default conditionalAuth;
