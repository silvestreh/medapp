import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

const conditionalAuth = () => async (context: any) => {
  const action = context.data?.action;
  const publicActions = ['generate-authentication-options', 'verify-authentication'];

  if (publicActions.includes(action)) {
    return context;
  }

  const authHook = authenticate('jwt');
  return authHook(context);
};

export default {
  before: {
    all: [],
    create: [conditionalAuth()],
  },
  after: {
    all: [],
    create: [],
  },
  error: {
    all: [],
    create: [],
  },
} as HooksObject;
