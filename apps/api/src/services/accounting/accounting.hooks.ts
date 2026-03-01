import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      checkPermissions(),
    ],
    find: [],
    get: [],
  },
  after: {
    all: [],
    find: [],
    get: [],
  },
  error: {
    all: [],
    find: [],
    get: [],
  },
} as HooksObject;
