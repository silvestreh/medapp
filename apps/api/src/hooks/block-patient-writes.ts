import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

/**
 * Rejects patient-token requests on medic-managed write methods. Services
 * authenticated with authenticateProviderOrPatient accept patient tokens on
 * every method, so writes that only providers should perform (e.g. creating
 * treatments or dose schedules) must opt out explicitly.
 */
const blockPatientWrites = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.params.patient) {
    throw new Forbidden('Patients cannot modify these records');
  }
  return context;
};

export default blockPatientWrites;
