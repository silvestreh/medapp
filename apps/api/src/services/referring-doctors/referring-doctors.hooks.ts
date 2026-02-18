import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt')],
    find: [],
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
