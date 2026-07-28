import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import requireOrganizationContext from '../../hooks/require-organization-context';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), verifyOrganizationMembership()],
    // The class falls back to a global medic/referrer list when
    // params.organizationId is missing — never allow that externally
    find: [requireOrganizationContext()],
  },
  after: {
    all: [],
    find: [],
  },
  error: {
    all: [],
    find: [],
  },
} as HooksObject;
