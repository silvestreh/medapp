import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeToPatient from '../../hooks/scope-to-patient';
import mockTestUser from '../../hooks/mock-test-user';
import restrictToMedicWithShares from '../../hooks/restrict-to-medic-with-shares';
import blockPatientWrites from '../../hooks/block-patient-writes';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';

const authHook = authenticateProviderOrPatient(['https://sire.athel.as']);

// Shared medics may patch (e.g. nextControlDate when adding a control), but
// only the owning medic may remove a treatment
const restrictToMedic = restrictToMedicWithShares({ sharedWrites: ['patch'] });

export default {
  before: {
    all: [authHook, mockTestUser('sire-treatments')],
    find: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      restrictToMedic,
      scopeToPatient(),
    ],
    get: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      restrictToMedic,
      scopeToPatient(),
    ],
    create: [
      blockPatientWrites(),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      restrictToMedic,
    ],
    update: [disallow('external')],
    patch: [
      blockPatientWrites(),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      restrictToMedic,
    ],
    remove: [
      blockPatientWrites(),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      restrictToMedic,
    ]
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
