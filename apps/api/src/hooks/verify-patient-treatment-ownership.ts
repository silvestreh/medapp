import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import { isTestPatient } from '../test-user';

/**
 * For patient-token creates on treatment-linked services (sire-readings,
 * sire-dose-logs): verifies the referenced treatment belongs to the patient
 * and keeps the record's denormalized columns consistent with it, so a
 * patient cannot attach records to another patient's treatment.
 */
const verifyPatientTreatmentOwnership = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { patient } = context.params;

  if (!patient) return context;
  if (isTestPatient(patient.id)) return context;

  // A previous hook may have already resolved the result (skip the query)
  if (context.result !== undefined) return context;

  const treatmentId = context.data?.treatmentId;
  if (!treatmentId) return context;

  const treatment: any = await context.app.service('sire-treatments').get(treatmentId);
  if (String(treatment.patientId) !== String(patient.id)) {
    throw new Forbidden('Cannot create records for this treatment');
  }

  context.data = {
    ...context.data,
    patientId: patient.id,
    organizationId: treatment.organizationId,
  };

  return context;
};

export default verifyPatientTreatmentOwnership;
