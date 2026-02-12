import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { checkPermissions } from '../../hooks/check-permissions';
import populateResults from './hooks/populate-results';
import populatePatient from './hooks/populate-patient';
import autoProtocol from './hooks/auto-protocol';
import { omitForDeleted } from '../../hooks/omit-for-deleted';
import { sortByPersonalDataRank } from '../../hooks/find-by-personal-data';
import searchStudies from './hooks/search-studies';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      checkPermissions({ foreignKey: 'medicId' })
    ],
    find: [searchStudies()],
    get: [],
    create: [autoProtocol()],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [
      populateResults(),
      populatePatient(),
      omitForDeleted({ service: 'patients', fkey: 'patientId' }),
      sortByPersonalDataRank({ foreignKey: 'patientId' })
    ],
    get: [
      populateResults(),
      populatePatient(),
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
