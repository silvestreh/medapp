import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), verifyOrganizationMembership()],
    get: [],
    create: [],
  },
  after: {
    all: [],
    get: [],
    create: [],
  },
  error: {
    all: [],
    get: [],
    create: [],
  },
} as HooksObject;
