import { HooksObject } from '@feathersjs/feathers';
import authenticatePatient from './hooks/authenticate-patient';

export default {
  before: {
    all: [authenticatePatient()],
  },
  after: {
    all: [],
  },
  error: {
    all: [],
  },
} as HooksObject;
