import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import prepareConfirmation from './hooks/prepare-confirmation';
import sendConfirmationEmail from './hooks/send-confirmation-email';
import handleReset from './hooks/handle-reset';
import handleEmailConfirmation from './hooks/handle-email-confirmation';

const ALLOWED_ACTIONS = ['reset', 'confirm-email'];

const allowPublicPatch = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { data, params } = context;
  if (ALLOWED_ACTIONS.includes(data?.action) && params.provider) {
    context.params = { ...params, authenticated: true };
  }
  return context;
};

export default {
  before: {
    all: [],
    find: [disallow('external')],
    get: [disallow('external')],
    create: [prepareConfirmation()],
    update: [disallow('external')],
    patch: [allowPublicPatch(), handleReset(), handleEmailConfirmation()],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [sendConfirmationEmail()],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
} as HooksObject;
