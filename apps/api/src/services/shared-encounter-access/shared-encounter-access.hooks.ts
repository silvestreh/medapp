import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import { setGrantingMedic } from './hooks/set-granting-medic';
import { scopeToMedic } from './hooks/scope-to-medic';
import { authorizeGrantRemoval } from './hooks/authorize-grant-removal';
import { validateGrantedIsMedic } from './hooks/validate-granted-is-medic';
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
    find: [scopeToMedic()],
    get: [],
    create: [
      setGrantingMedic(),
      validateGrantedIsMedic(),
    ],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [authorizeGrantRemoval()]
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
