import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import { checkPermissions } from '../../hooks/check-permissions';
import { logAccess } from '../../hooks/log-access';

const { authenticate } = authentication.hooks;

function populatePatient(): Hook {
  return async (context: HookContext) => {
    const { app, result, method } = context;

    const records = method === 'find'
      ? Array.isArray(result) ? result : result.data
      : [result];

    if (!records?.length) return context;

    const uniquePatientIds = [...new Set(
      records.map((r: any) => r.patientId).filter(Boolean)
    )];

    if (uniquePatientIds.length === 0) return context;

    const patients = await app.service('patients').find({
      query: { id: { $in: uniquePatientIds } },
      paginate: false,
      disableSoftDelete: true,
    });

    const patientMap = new Map(
      (patients as any[]).map((p: any) => [p.id, p])
    );

    records.forEach((record: any) => {
      record.patient = patientMap.get(record.patientId) || null;
    });

    return context;
  };
}

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      checkPermissions(),
    ],
    find: [],
    get: [],
    create: [disallow('external')],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')],
  },

  after: {
    all: [],
    find: [populatePatient(), logAccess({ resource: 'prescriptions' })],
    get: [populatePatient(), logAccess({ resource: 'prescriptions' })],
    create: [logAccess({
      resource: 'prescriptions',
      getMetadata: (context) => {
        const userId = String(context.params?.user?.id || '');
        const medicId = context.result?.medicId;
        if (medicId && String(medicId) !== userId) {
          return { onBehalfOfMedicId: String(medicId) };
        }
        return undefined;
      },
    })],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
} as HooksObject;
