import { HooksObject } from '@feathersjs/feathers';
import authenticatePatient from '../../hooks/authenticate-patient';
import rejectClientAmount from './hooks/reject-client-amount';

export default {
  before: {
    all: [authenticatePatient('https://booking.athel.as')],
    create: [rejectClientAmount()],
  },
  after: {
    all: [],
  },
  error: {
    all: [],
  },
} as HooksObject;
