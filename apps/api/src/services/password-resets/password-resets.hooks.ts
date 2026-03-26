import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import prepareReset from './hooks/prepare-reset';
import sendResetEmail from './hooks/send-reset-email';
import handleReset from './hooks/handle-reset';

const allowPublicResetPatch = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { data, params } = context;
  if (data?.action === 'reset' && params.provider) {
    context.params = { ...params, authenticated: true };
  }
  return context;
};

export default {
  before: {
    all: [],
    find: [disallow('external')],
    get: [disallow('external')],
    create: [prepareReset()],
    update: [disallow('external')],
    patch: [allowPublicResetPatch(), handleReset()],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [sendResetEmail()],
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
