import { HooksObject } from '@feathersjs/feathers';
import { authenticate } from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

export default {
  before: {
    all: [],
    find: [disallow()],
    get: [disallow()],
    create: [authenticate('jwt')],
    update: [disallow()],
    patch: [disallow()],
    remove: [disallow()],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
} as HooksObject;
