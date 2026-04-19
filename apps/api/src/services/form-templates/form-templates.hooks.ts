import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
import { setCreatedBy } from './hooks/set-created-by';
import { generateFormKey } from './hooks/generate-form-key';
import { validateSchema } from './hooks/validate-schema';
import { storePreviousData } from './hooks/store-previous-data';
import { publishSchema } from './hooks/publish-schema';
import { preventPublishedRemoval } from './hooks/prevent-published-removal';
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
    find: [],
    get: [],
    create: [setCreatedBy(), generateFormKey(), validateSchema()],
    update: [disallow('external')],
    patch: [storePreviousData(), validateSchema()],
    remove: [preventPublishedRemoval()]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [publishSchema()],
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
