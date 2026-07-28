import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeToPatient from '../../hooks/scope-to-patient';
import mockTestUser from '../../hooks/mock-test-user';
import scopeChildRecordsToMedic from '../../hooks/scope-child-records-to-medic';
import verifyPatientTreatmentOwnership from '../../hooks/verify-patient-treatment-ownership';
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

// Providers reach readings through their accessible treatments (own, shared
// via shared-encounter-access, or sire-treatments:find:all)
const scopeToTreatments = scopeChildRecordsToMedic({
  parentService: 'sire-treatments',
  foreignKey: 'treatmentId',
});

export default {
  before: {
    all: [authHook, mockTestUser('sire-readings')],
    find: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      scopeToTreatments,
      scopeToPatient(),
    ],
    get: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      scopeToPatient(),
    ],
    create: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      scopeToTreatments,
      scopeToPatient(),
      verifyPatientTreatmentOwnership(),
    ],
    update: [disallow('external')],
    patch: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      scopeToTreatments,
      scopeToPatient(),
    ],
    remove: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      scopeToTreatments,
      scopeToPatient(),
    ]
  },

  after: {
    all: [],
    find: [],
    get: [scopeToTreatments],
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
