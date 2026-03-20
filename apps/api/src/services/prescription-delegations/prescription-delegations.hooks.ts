import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import { setMedicId } from './hooks/set-medic-id';
import { scopeToUser } from './hooks/scope-to-user';
import { authorizeRemoval } from './hooks/authorize-removal';
import { validatePrescriberRole } from './hooks/validate-prescriber-role';
import { logDelegation } from './hooks/log-delegation';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization()
    ],
    find: [scopeToUser()],
    get: [],
    create: [
      setMedicId(),
      validatePrescriberRole(),
    ],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [authorizeRemoval()]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [logDelegation()],
    update: [],
    patch: [],
    remove: [logDelegation()]
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
