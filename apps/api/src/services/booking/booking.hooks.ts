import { HooksObject } from '@feathersjs/feathers';
import authenticatePatient from '../../hooks/authenticate-patient';

export default {
  before: {
    all: [authenticatePatient('https://booking.athel.as')],
  },
  after: {
    all: [],
  },
  error: {
    all: [],
  },
} as HooksObject;
