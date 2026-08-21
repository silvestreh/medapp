import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { checkPermissions } from '../../hooks/check-permissions';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import requireOrganizationContext from '../../hooks/require-organization-context';
import validatePaymentSettings from './hooks/validate-payment-settings';
import attachResolvedFee from './hooks/attach-resolved-fee';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      requireOrganizationContext(),
      checkPermissions({ foreignKey: 'userId' })
    ],
    find: [],
    get: [],
    create: [validatePaymentSettings()],
    update: [disallow('external')],
    patch: [validatePaymentSettings()],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [attachResolvedFee()],
    get: [attachResolvedFee()],
    create: [attachResolvedFee()],
    update: [],
    patch: [attachResolvedFee()],
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
