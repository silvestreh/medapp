import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import scopeSchedulesToPatient from './hooks/scope-schedules-to-patient';
import mockTestUser from '../../hooks/mock-test-user';
import scopeChildRecordsToMedic from '../../hooks/scope-child-records-to-medic';
import blockPatientWrites from '../../hooks/block-patient-writes';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import sendSirePush from '../../hooks/send-sire-push';

const pushOnScheduleChange = sendSirePush({
  getPatientId: async (context) => {
    const treatment = await context.app.service('sire-treatments').get(context.result.treatmentId);
    return String((treatment as any).patientId);
  },
  getTitle: () => 'Nuevo esquema de dosis',
  getBody: () => 'Tu médico actualizó tu esquema de dosis. Revisá los cambios.',
  getData: (context) => ({ type: 'schedule-update', treatmentId: context.result.treatmentId }),
});

const authHook = authenticateProviderOrPatient(['https://sire.athel.as']);

// Providers reach schedules through their accessible treatments (own, shared
// via shared-encounter-access, or sire-treatments:find:all)
const scopeToTreatments = scopeChildRecordsToMedic({
  parentService: 'sire-treatments',
  foreignKey: 'treatmentId',
});

export default {
  before: {
    all: [authHook, mockTestUser('sire-dose-schedules')],
    find: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      scopeToTreatments,
      scopeSchedulesToPatient(),
    ],
    get: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
    ],
    create: [
      blockPatientWrites(),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      scopeToTreatments,
    ],
    update: [disallow('external')],
    patch: [
      blockPatientWrites(),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      scopeToTreatments,
    ],
    remove: [
      blockPatientWrites(),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      scopeToTreatments,
    ]
  },

  after: {
    all: [],
    find: [],
    get: [scopeToTreatments, scopeSchedulesToPatient()],
    create: [pushOnScheduleChange],
    update: [],
    patch: [pushOnScheduleChange],
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
