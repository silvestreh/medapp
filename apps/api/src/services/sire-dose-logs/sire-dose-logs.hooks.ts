import { HooksObject } from '@feathersjs/feathers';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeToPatient from '../../hooks/scope-to-patient';

const authHook = authenticateProviderOrPatient(['https://sire.athel.as']);

export default {
  before: {
    all: [authHook],
    find: [scopeToPatient()],
    get: [scopeToPatient()],
    create: [scopeToPatient()],
    update: [],
    patch: [scopeToPatient()],
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
