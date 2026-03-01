import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import requireUserManagement from './hooks/require-user-management';
import prepareInvite from './hooks/prepare-invite';
import resolveAndNotify from './hooks/resolve-and-notify';
import allowPublicTokenLookup from './hooks/allow-public-token-lookup';
import allowPublicAcceptPatch from './hooks/allow-public-accept-patch';
import handleAcceptAction from './hooks/handle-accept-action';
import sanitizeFindResult from './hooks/sanitize-find-result';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [],
    find: [allowPublicTokenLookup()],
    get: [authenticate('jwt')],
    create: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      requireUserManagement(),
      prepareInvite(),
    ],
    update: [authenticate('jwt')],
    patch: [
      allowPublicAcceptPatch(),
      handleAcceptAction(),
    ],
    remove: [authenticate('jwt')]
  },

  after: {
    all: [],
    find: [sanitizeFindResult()],
    get: [],
    create: [resolveAndNotify()],
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
