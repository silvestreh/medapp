import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden, NotFound } from '@feathersjs/errors';
import { isTestPatient } from '../../../test-user';

/**
 * sire_dose_schedules has no patientId column — ownership is derived through
 * treatmentId → sire_treatments.patientId — so the generic scopeToPatient
 * hook cannot be used here (it filters on a column that does not exist).
 *
 * before find: constrains the query to the patient's own treatments.
 * after get: verifies the fetched schedule's treatment belongs to the patient.
 */
const scopeSchedulesToPatient = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { patient } = context.params;

  // Not a patient request — skip (provider has full access)
  if (!patient) return context;

  // The demo test patient is served mock data by mockTestUser and has no real
  // treatments to scope against
  if (isTestPatient(patient.id)) return context;

  if (context.type === 'before' && context.method === 'find') {
    // A previous hook may have already resolved the result (skip the query)
    if (context.result !== undefined) return context;

    const treatments = (await context.app.service('sire-treatments').find({
      query: { patientId: patient.id, $select: ['id'] },
      paginate: false,
    })) as any[];
    const allowedIds = treatments.map((treatment) => String(treatment.id));

    const requested = context.params.query?.treatmentId;
    if (typeof requested === 'string') {
      if (!allowedIds.includes(requested)) {
        throw new Forbidden('Cannot access schedules for this treatment');
      }
    } else {
      context.params.query = {
        ...context.params.query,
        treatmentId: { $in: allowedIds },
      };
    }
  }

  if (context.type === 'after' && context.method === 'get' && context.result) {
    const treatment: any = await context.app.service('sire-treatments').get(context.result.treatmentId);
    if (String(treatment.patientId) !== String(patient.id)) {
      throw new NotFound(`No record found for id '${context.id}'`);
    }
  }

  return context;
};

export default scopeSchedulesToPatient;
