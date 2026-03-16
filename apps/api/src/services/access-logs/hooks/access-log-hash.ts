import { createHash } from 'crypto';
import type { Id } from '@feathersjs/feathers';

export interface HashableAccessLog {
  id: Id;
  userId: Id | null;
  organizationId: Id | null;
  resource: string;
  patientId: Id | null;
  action: string;
  purpose: string;
  refesId: string | null;
  ip: string | null;
  metadata: Record<string, any> | null;
}

export function computeAccessLogHash(
  log: HashableAccessLog,
  previousHash: string | null
): string {
  const payload = JSON.stringify({
    id: String(log.id),
    userId: log.userId ? String(log.userId) : '',
    organizationId: log.organizationId ? String(log.organizationId) : '',
    resource: log.resource,
    patientId: log.patientId ? String(log.patientId) : '',
    action: log.action,
    purpose: log.purpose,
    refesId: log.refesId || '',
    ip: log.ip || '',
    metadata: log.metadata ? JSON.stringify(log.metadata) : '',
    previousHash: previousHash || '',
  });

  return createHash('sha256').update(payload).digest('hex');
}
