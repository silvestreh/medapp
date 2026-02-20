import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { restrictToOwner } from './hooks/restrict-to-owner';

const { authenticate } = authentication.hooks;

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
