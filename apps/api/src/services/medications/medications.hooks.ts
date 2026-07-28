import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { searchMedications } from './hooks/search-medications';

const { authenticate } = authentication.hooks;

export default {
  before: {
    // Reference catalog (vademecum): authenticated reads, internal-only writes
    all: [],
    find: [authenticate('jwt'), searchMedications()],
    get: [authenticate('jwt')],
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
