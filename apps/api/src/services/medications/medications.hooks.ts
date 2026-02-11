import { HookContext } from '@feathersjs/feathers';
import { searchMedications } from './hooks/search-medications';

export default {
  before: {
    all: [],
    find: [searchMedications()],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
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
