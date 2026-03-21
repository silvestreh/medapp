import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
import { ensureSystemPractices } from './hooks/ensure-system-practices';
import { scopeToOrganization } from './hooks/scope-to-organization';
import { setOrganizationId } from './hooks/set-organization-id';
import { validatePractice } from './hooks/validate-practice';
import { preventSystemEdit, preventSystemRemoval } from './hooks/prevent-system-edit';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      checkPermissions()
    ],
    find: [ensureSystemPractices(), scopeToOrganization()],
    get: [],
    create: [setOrganizationId(), validatePractice()],
    update: [disallow('external')],
    patch: [preventSystemEdit()],
    remove: [preventSystemRemoval()]
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
