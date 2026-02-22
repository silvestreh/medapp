import { HookContext, HooksObject } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

const restrictToOrgOwner = () => async (context: HookContext) => {
  const { app, id, params } = context;
  const userId = params.user?.id;
  if (!userId || !id) throw new Forbidden('Not allowed');

  const memberships: any[] = await app.service('organization-users').find({
    query: { organizationId: id, userId, role: 'owner' },
    paginate: false,
  } as any);

  if (memberships.length === 0) {
    throw new Forbidden('Only the organization owner can perform this action');
  }

  return context;
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [restrictToOrgOwner()],
    remove: [restrictToOrgOwner()]
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
