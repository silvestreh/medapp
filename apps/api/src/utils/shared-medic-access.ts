import type { Application } from '@feathersjs/feathers';

export interface ShareGrant {
  id: string;
  grantingMedicId: string;
  grantedMedicId: string;
  patientId: string;
  organizationId: string;
}

/**
 * Share grants are patient-level (grantingMedic → grantedMedic for one patient
 * within one organization) and live in shared_encounter_access. They were
 * introduced for encounters but grant access to the granting medic's records
 * for that patient across resources (encounters, studies, SIRE data).
 */

/** All share grants received by a medic within an organization. */
export async function findShareGrants(
  app: Application,
  grantedMedicId: string,
  organizationId: string
): Promise<ShareGrant[]> {
  const grants = await app.service('shared-encounter-access').find({
    query: { grantedMedicId, organizationId },
    paginate: false,
  });
  return grants as unknown as ShareGrant[];
}

export async function hasShareGrant(
  app: Application,
  query: {
    grantingMedicId: string;
    grantedMedicId: string;
    patientId: string;
    organizationId: string;
  }
): Promise<boolean> {
  const grants = await app.service('shared-encounter-access').find({
    query,
    paginate: false,
  });
  return Array.isArray(grants) && grants.length > 0;
}

/**
 * Conditions matching records a medic can read: their own plus records owned
 * by medics who shared the patient with them. Meant to be used inside an $or.
 */
export function ownOrSharedConditions(
  userId: string,
  grants: ShareGrant[]
): Record<string, string>[] {
  return [
    { medicId: userId },
    ...grants.map((grant) => ({
      medicId: grant.grantingMedicId,
      patientId: grant.patientId,
    })),
  ];
}
