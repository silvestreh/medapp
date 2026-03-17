import { HooksObject } from '@feathersjs/feathers';
import authenticateProviderOrPatient from '../../hooks/authenticate-provider-or-patient';
import mockTestUser from '../../hooks/mock-test-user';
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

export default {
  before: {
    all: [authHook, mockTestUser('sire-dose-schedules')],
    find: [],
    get: [],
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
