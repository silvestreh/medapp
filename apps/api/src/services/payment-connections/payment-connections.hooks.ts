import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import stripPaymentSecrets from '../../hooks/strip-payment-secrets';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

// The class only ever operates on params.user.id ('current'), so there is no
// foreignKey scoping to configure — a caller can never name another user's
// connection. find/update/patch have no meaning here and stay internal-only.
export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization()
    ],
    find: [disallow('external')],
    get: [],
    create: [],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: []
  },

  after: {
    all: [stripPaymentSecrets()],
    find: [],
    get: [],
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
