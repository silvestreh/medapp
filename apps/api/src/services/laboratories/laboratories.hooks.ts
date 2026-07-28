import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

const { authenticate } = authentication.hooks;

export default {
  before: {
    // Reference catalog: authenticated reads, internal-only writes
    all: [authenticate('jwt')],
    find: [],
    get: [],
    create: [disallow('external')],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')]
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
};
