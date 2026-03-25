import * as authentication from '@feathersjs/authentication';
import { searchPrepagas } from './hooks/search-prepagas';
import { checkPermissions } from '../../hooks/check-permissions';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [],
    find: [authenticate('jwt'), searchPrepagas()],
    get: [authenticate('jwt')],
    create: [],
    update: [],
    patch: [authenticate('jwt'), checkPermissions({ scopeToOrganization: false })],
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
