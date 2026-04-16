import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
import { setUserId } from './hooks/set-user-id';
import { scopeToUser } from './hooks/scope-to-user';
import { validateUserIsMedic } from './hooks/validate-user-is-medic';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      checkPermissions({ scopeToOrganization: false })
    ],
    find: [scopeToUser()],
    get: [],
    create: [setUserId(), validateUserIsMedic()],
    update: [disallow('external')],
    patch: [scopeToUser()],
    remove: [scopeToUser()]
  },

  after: {
    all: [],
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
