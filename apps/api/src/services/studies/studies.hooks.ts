import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { checkPermissions } from '../../hooks/check-permissions';
import populateResults from './hooks/populate-results';
import { omitForDeleted } from '../../hooks/omit-for-deleted';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      checkPermissions({ foreignKey: 'medicId' })
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [
      populateResults(),
      omitForDeleted({ service: 'patients', fkey: 'patientId' })
    ],
    get: [
      populateResults(),
      omitForDeleted({ service: 'patients', fkey: 'patientId' })
    ],
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
