import { HooksObject } from '@feathersjs/feathers';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeToPatient from '../../hooks/scope-to-patient';
import mockTestUser from '../../hooks/mock-test-user';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import sendSirePush from '../../hooks/send-sire-push';

const pushOnNewReading = sendSirePush({
  getPatientId: async (context) => String(context.result.patientId),
  getTitle: () => 'Nuevo control registrado',
  getBody: (context) => `Se registró un nuevo valor de INR: ${context.result.inr}`,
  getData: (context) => ({ type: 'new-reading', treatmentId: context.result.treatmentId }),
});

const authHook = authenticateProviderOrPatient(['https://sire.athel.as']);

export default {
  before: {
    all: [authHook, mockTestUser('sire-readings')],
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
    create: [pushOnNewReading],
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
