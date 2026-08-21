import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import { logAccess } from '../../hooks/log-access';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [],
    find: [disallow('external')],
    get: [disallow('external')],
    // Same identity/org gate as `encounters`; the per-encounter permission
    // check happens inside the class via `encounters.get`.
    create: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
    ],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')],
  },
  after: {
    all: [],
    find: [],
    get: [],
    // Distinct from the `encounters` read the class triggers: records WHICH
    // attachment was opened. `resource` stays 'encounters' (DB enum).
    create: [
      logAccess({
        resource: 'encounters',
        action: 'read',
        getPatientId: context => context.result?.patientId,
        getMetadata: context => ({
          attachment: context.result?.filename,
          attachmentFileName: context.result?.fileName,
          encounterId: context.result?.encounterId,
          via: 'attachment-link',
        }),
      }),
    ],
    update: [],
    patch: [],
    remove: [],
  },
  error: { all: [], find: [], get: [], create: [], update: [], patch: [], remove: [] },
} as HooksObject;
