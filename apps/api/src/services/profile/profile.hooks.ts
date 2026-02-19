import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt')],
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
