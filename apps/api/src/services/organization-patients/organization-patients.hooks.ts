import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';

// Internal-only junction table (patient ↔ organization). It is consumed by
// hooks like scopePatientsToOrganization / linkPatientToOrganization; exposing
// it externally would leak the patient↔org mapping and allow linking foreign
// patients into one's own organization.
export default {
  before: {
    all: [disallow('external')],
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
