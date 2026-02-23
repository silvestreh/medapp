import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import restrictToOrgOwner from './hooks/restrict-to-org-owner';

const { authenticate } = authentication.hooks;

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
