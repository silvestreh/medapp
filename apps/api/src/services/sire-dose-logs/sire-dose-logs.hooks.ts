import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeToPatient from '../../hooks/scope-to-patient';
import mockTestUser from '../../hooks/mock-test-user';
import scopeChildRecordsToMedic from '../../hooks/scope-child-records-to-medic';
import verifyPatientTreatmentOwnership from '../../hooks/verify-patient-treatment-ownership';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { blockSuperAdmin } from '../../hooks/block-super-admin';

const authHook = authenticateProviderOrPatient(['https://sire.athel.as']);

// Providers reach dose logs through their accessible treatments (own, shared
// via shared-encounter-access, or sire-treatments:find:all)
const scopeToTreatments = scopeChildRecordsToMedic({
  parentService: 'sire-treatments',
  foreignKey: 'treatmentId',
});

export default {
  before: {
    all: [authHook, mockTestUser('sire-dose-logs')],
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
      scopeToTreatments,
      scopeToPatient(),
      verifyPatientTreatmentOwnership(),
    ],
    update: [disallow('external')],
    patch: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      scopeToTreatments,
      scopeToPatient(),
    ],
    remove: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      scopeToTreatments,
      scopeToPatient(),
    ]
  },

  after: {
    all: [],
    find: [],
    get: [scopeToTreatments],
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
