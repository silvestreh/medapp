import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

const restrictToOwner = () => (context: any) => {
  const userId = context.params?.user?.id;
  if (!userId) return context;

  if (context.method === 'find') {
    context.params.query = { ...context.params.query, userId };
  }

  return context;
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [restrictToOwner()],
    get: [restrictToOwner()],
    create: [],
    update: [restrictToOwner()],
    patch: [restrictToOwner()],
    remove: [restrictToOwner()]
  },
  after: {
    all: [],
    find: [],
    get: [],
    create: [],
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
