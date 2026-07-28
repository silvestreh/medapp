import { HooksObject } from '@feathersjs/feathers';
import authenticatePatient from '../../hooks/authenticate-patient';
import mockTestUser from '../../hooks/mock-test-user';
import scopeToPatient from '../../hooks/scope-to-patient';

const authHook = authenticatePatient(['https://sire.athel.as']);

export default {
  before: {
    // scopeToPatient keeps every method restricted to the requesting
    // patient's own tokens (find/get/patch/remove filter, create forces
    // patientId); internal calls (e.g. send-sire-push) are unaffected
    all: [authHook, mockTestUser('sire-push-tokens'), scopeToPatient()],
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
