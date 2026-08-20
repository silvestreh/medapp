import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { checkPermissions } from '../../hooks/check-permissions';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import populateResults from './hooks/populate-results';
import populatePatient from './hooks/populate-patient';
import autoProtocol from './hooks/auto-protocol';
import { commitStudyTransaction } from './hooks/commit-study-transaction';
import { rollbackStudyTransaction } from './hooks/rollback-study-transaction';
import extractStudyResults from './hooks/extract-study-results';
import upsertStudyResults from './hooks/upsert-study-results';
import { clearReferringDoctor, populateReferringDoctor } from './hooks/resolve-referring-doctor';
import sanitizeReferringDoctor from './hooks/sanitize-referring-doctor';
import restrictToMedicWithShares from '../../hooks/restrict-to-medic-with-shares';
import { sortByPersonalDataRank } from '../../hooks/find-by-personal-data';
import searchStudies from './hooks/search-studies';
import { requireVerifiedLicense } from '../../hooks/require-verified-license';
import populateInsurer from './hooks/populate-insurer';
import { setCost } from '../practice-costs/hooks/set-cost';
import { updateCost } from '../practice-costs/hooks/update-cost';
import { logAccess } from '../../hooks/log-access';
import preventPatientChangeWithResults from './hooks/prevent-patient-change-with-results';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

// Reads honor patient-level share grants (shared-encounter-access);
// patch/remove stay owner-only
const restrictToMedic = restrictToMedicWithShares();

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
      restrictToMedic,
      searchStudies()
    ],
    get: [restrictToMedic],
    create: [
      requireVerifiedLicense(),
      restrictToMedic,
      sanitizeReferringDoctor(),
      clearReferringDoctor(),
      extractStudyResults(),
      // Last on purpose: opens the protocol-serializing transaction, so the
      // window between BEGIN and the INSERT stays as small as possible.
      autoProtocol()
    ],
    update: [],
    patch: [
      requireVerifiedLicense(),
      restrictToMedic,
      preventPatientChangeWithResults(),
      sanitizeReferringDoctor(),
      clearReferringDoctor(),
      extractStudyResults()
    ],
    remove: [restrictToMedic]
  },

  after: {
    all: [],
    find: [
      populateResults(),
      populatePatient(),
      populateInsurer(),
      populateReferringDoctor(),
      sortByPersonalDataRank({ foreignKey: 'patientId' }),
      logAccess({ resource: 'studies' })
    ],
    get: [
      populateResults(),
      populatePatient(),
      populateInsurer(),
      populateReferringDoctor(),
      logAccess({ resource: 'studies' })
    ],
    create: [
      // First on purpose: commits the INSERT and releases the protocol lock
      // before the remaining hooks run their own queries.
      commitStudyTransaction(),
      upsertStudyResults(),
      setCost('study'),
      populateReferringDoctor(),
      logAccess({ resource: 'studies' })
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
    create: [rollbackStudyTransaction()],
    update: [],
    patch: [],
    remove: []
  }
} as HooksObject;
