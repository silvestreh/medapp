import { createHash } from 'crypto';
import type { Id } from '@feathersjs/feathers';

export interface HashableEncounter {
  id: Id;
  patientId: Id;
  medicId: Id;
  date: string | Date;
  insurerId?: Id | null;
  data: Record<string, any> | string;
}

export function computeEncounterHash(
  encounter: HashableEncounter,
  previousHash: string | null
): string {
  const normalizedData = typeof encounter.data === 'string'
    ? encounter.data
    : JSON.stringify(encounter.data);

  const payload = JSON.stringify({
    id: String(encounter.id),
    patientId: String(encounter.patientId),
    medicId: String(encounter.medicId),
    date: new Date(encounter.date).toISOString(),
    insurerId: encounter.insurerId ? String(encounter.insurerId) : null,
    data: normalizedData,
    previousHash: previousHash || '',
  });

  return createHash('sha256').update(payload).digest('hex');
}
