import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { checkPermissions } from '../../hooks/check-permissions';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import populateResults from './hooks/populate-results';
import populatePatient from './hooks/populate-patient';
import autoProtocol from './hooks/auto-protocol';
import extractStudyResults from './hooks/extract-study-results';
import upsertStudyResults from './hooks/upsert-study-results';
import { clearReferringDoctor, populateReferringDoctor } from './hooks/resolve-referring-doctor';
import restrictToMedic from './hooks/restrict-to-medic';
import { sortByPersonalDataRank } from '../../hooks/find-by-personal-data';
import searchStudies from './hooks/search-studies';
import { requireVerifiedLicense } from '../../hooks/require-verified-license';
import populateInsurer from './hooks/populate-insurer';
import { setCost } from '../practice-costs/hooks/set-cost';
import { updateCost } from '../practice-costs/hooks/update-cost';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      checkPermissions()
    ],
    find: [
      restrictToMedic(),
      searchStudies()
    ],
    get: [restrictToMedic()],
    create: [
      requireVerifiedLicense(),
      restrictToMedic(),
      clearReferringDoctor(),
      autoProtocol(),
      extractStudyResults()
    ],
    update: [],
    patch: [
      requireVerifiedLicense(),
      restrictToMedic(),
      clearReferringDoctor(),
      extractStudyResults()
    ],
    remove: [restrictToMedic()]
  },

  after: {
    all: [],
    find: [
      populateResults(),
      populatePatient(),
      populateInsurer(),
      populateReferringDoctor(),
      sortByPersonalDataRank({ foreignKey: 'patientId' })
    ],
    get: [
      populateResults(),
      populatePatient(),
      populateInsurer(),
      populateReferringDoctor(),
    ],
    create: [
      upsertStudyResults(),
      setCost('study'),
      populateReferringDoctor()
    ],
    update: [],
    patch: [
      upsertStudyResults(),
      updateCost('study'),
      populateReferringDoctor()
    ],
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
