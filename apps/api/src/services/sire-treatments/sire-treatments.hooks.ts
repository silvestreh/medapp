import { HooksObject } from '@feathersjs/feathers';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeToPatient from '../../hooks/scope-to-patient';
import mockTestUser from '../../hooks/mock-test-user';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';

const authHook = authenticateProviderOrPatient(['https://sire.athel.as']);

export default {
  before: {
    all: [authHook, mockTestUser('sire-treatments')],
    find: [scopeToPatient()],
    get: [scopeToPatient()],
    create: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
    ],
    update: [],
    patch: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
    ],
    remove: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
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
