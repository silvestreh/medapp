import { HooksObject } from '@feathersjs/feathers';
import conditionalAuth from './hooks/conditional-auth';

export default {
  before: {
    all: [],
    create: [conditionalAuth()],
  },
  after: {
    all: [],
    create: [],
  },
  error: {
    all: [],
    create: [],
  },
} as HooksObject;
