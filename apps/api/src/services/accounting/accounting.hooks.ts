import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
    ],
    find: [],
  },
  after: {
    all: [],
    find: [],
  },
  error: {
    all: [],
    find: [],
  },
} as HooksObject;
