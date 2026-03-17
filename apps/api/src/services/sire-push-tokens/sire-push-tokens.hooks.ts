import { HooksObject } from '@feathersjs/feathers';
import authenticatePatient from '../../hooks/authenticate-patient';

const authHook = authenticatePatient(['https://sire.athel.as']);

export default {
  before: {
    all: [authHook],
    find: [],
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
} as HooksObject;
