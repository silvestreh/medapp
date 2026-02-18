import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { checkPermissions } from '../../hooks/check-permissions';
import populateResults from './hooks/populate-results';
import populatePatient from './hooks/populate-patient';
import autoProtocol from './hooks/auto-protocol';
import extractStudyResults from './hooks/extract-study-results';
import upsertStudyResults from './hooks/upsert-study-results';
import { clearReferringDoctor, populateReferringDoctor } from './hooks/resolve-referring-doctor';
import restrictToMedic from './hooks/restrict-to-medic';
import { sortByPersonalDataRank } from '../../hooks/find-by-personal-data';
import searchStudies from './hooks/search-studies';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      checkPermissions()
    ],
    find: [restrictToMedic(), searchStudies()],
    get: [restrictToMedic()],
    create: [restrictToMedic(), clearReferringDoctor(), autoProtocol(), extractStudyResults()],
    update: [],
    patch: [restrictToMedic(), clearReferringDoctor(), extractStudyResults()],
    remove: [restrictToMedic()]
  },

  after: {
    all: [],
    find: [
      populateResults(),
      populatePatient(),
      populateReferringDoctor(),
      sortByPersonalDataRank({ foreignKey: 'patientId' })
    ],
    get: [
      populateResults(),
      populatePatient(),
      populateReferringDoctor(),
    ],
    create: [upsertStudyResults(), populateReferringDoctor()],
    update: [],
    patch: [upsertStudyResults(), populateReferringDoctor()],
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
