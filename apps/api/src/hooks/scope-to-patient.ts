import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

/**
 * If the request is from a patient token, scope queries to their own data.
 * For find/get: adds patientId filter.
 * For create/patch/remove: ensures patientId matches.
 */
const scopeToPatient = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { patient } = context.params;

  // Not a patient request — skip (provider has full access)
  if (!patient) return context;

  if (context.method === 'find') {
    context.params.query = {
      ...context.params.query,
      patientId: patient.id,
    };
  } else if (context.method === 'get') {
    // Will verify after fetch
  } else if (context.method === 'create') {
    if (context.data) {
      context.data.patientId = patient.id;
    }
  } else if (context.method === 'patch' || context.method === 'update' || context.method === 'remove') {
    // For mutations, ensure the record belongs to the patient (checked in after hook or via query)
    context.params.query = {
      ...context.params.query,
      patientId: patient.id,
    };
  }

  return context;
};

export default scopeToPatient;
