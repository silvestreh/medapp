import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import restrictToOrgOwner from './hooks/restrict-to-org-owner';
import restrictOrgReads from './hooks/restrict-org-reads';
import validateSlug from './hooks/validate-slug';
import { disallow } from 'feathers-hooks-common';
import { protectIsActive } from './hooks/protect-is-active';
import registerHealthCenter from './hooks/register-health-center';
import { logConfigChange } from './hooks/log-config-change';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt')],
    find: [restrictOrgReads()],
    get: [],
    create: [protectIsActive(), validateSlug()],
    update: [validateSlug()],
    patch: [
      verifyOrganizationMembership(),
      restrictToOrgOwner(),
      protectIsActive(),
      validateSlug(),
    ],
    remove: [
      disallow('external'),
    ],
  },

  after: {
    all: [],
    find: [],
    get: [restrictOrgReads()],
    create: [],
    update: [],
    patch: [registerHealthCenter(), logConfigChange()],
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
