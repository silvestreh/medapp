import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { checkPermissions } from '../../hooks/check-permissions';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import requireOrganizationContext from '../../hooks/require-organization-context';
import stripPaymentSecrets from '../../hooks/strip-payment-secrets';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

// Professionals can only READ their own payment records (reconciliation list,
// per-appointment badge). All writes happen internally — booking, webhook
// processing, and the expiry cron — never from a client.
export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      requireOrganizationContext(),
      checkPermissions({ foreignKey: 'medicId' })
    ],
    find: [],
    get: [],
    create: [disallow('external')],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')]
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
