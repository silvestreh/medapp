import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import logger from '../../logger';

const { authenticate } = authentication.hooks;

const conditionalAuth = () => async (context: any) => {
  const action = context.data?.action;
  const publicActions = ['generate-authentication-options', 'verify-authentication'];

  if (publicActions.includes(action)) {
    logger.debug('[webauthn:hooks] skipping auth for public action=%s', action);
    return context;
  }

  logger.debug('[webauthn:hooks] requiring JWT auth for action=%s', action);
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
