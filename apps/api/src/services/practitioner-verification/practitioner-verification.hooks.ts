import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), verifyOrganizationMembership()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
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
};
