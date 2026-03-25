import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { searchPrepagas } from './hooks/search-prepagas';
import { checkPermissions } from '../../hooks/check-permissions';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [],
    find: [
      authenticate('jwt'),
      searchPrepagas()
    ],
    get: [authenticate('jwt')],
    create: [disallow('external')],
    update: [disallow('external')],
    patch: [
      authenticate('jwt'),
      checkPermissions({ scopeToOrganization: false })
    ],
    remove: [disallow('external')]
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
