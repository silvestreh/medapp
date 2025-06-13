import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { checkPermissions } from '../../hooks/check-permissions';
import { includePatient } from './hooks/include-patient';
import { addDuration } from './hooks/add-duration';
import { omitForDeleted } from '../../hooks/omit-for-deleted';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      checkPermissions()
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [includePatient()],
    find: [
      omitForDeleted({ service: 'patients', fkey: 'patientId' }),
      addDuration()
    ],
    get: [
      omitForDeleted({ service: 'patients', fkey: 'patientId' }),
      addDuration()
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
