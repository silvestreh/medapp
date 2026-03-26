import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import { checkPermissions } from '../../hooks/check-permissions';
import { logAccess } from '../../hooks/log-access';
import { stripTimestamps } from './hooks/strip-timestamps';
import { populatePatient } from './hooks/populate-patient';

const { authenticate } = authentication.hooks;

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
    create: [disallow('external'), stripTimestamps()],
    update: [disallow('external'), stripTimestamps()],
    patch: [disallow('external'), stripTimestamps()],
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
