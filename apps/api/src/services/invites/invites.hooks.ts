import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
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
    // get would return the raw invite (token included) without org checks —
    // the accept flow uses find?token= + patch, so external get is closed
    get: [disallow('external')],
    create: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      requireUserManagement(),
      prepareInvite(),
    ],
    update: [disallow('external')],
    patch: [
      allowPublicAcceptPatch(),
      handleAcceptAction(),
    ],
    // No UI flow removes invites externally; plain authenticate would let any
    // user delete any org's invites
    remove: [disallow('external')]
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
