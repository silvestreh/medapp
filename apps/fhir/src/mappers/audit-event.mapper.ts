import type { AuditEvent, AuditEventAgent, AuditEventEntity, CodeableConcept } from '@medplum/fhirtypes';
import { DOMAIN_SYSTEM } from '../utils/identifiers';

interface InternalAccessLog {
  id: string;
  userId: string | null;
  organizationId: string | null;
  resource: string;
  patientId: string | null;
  action: string;
  purpose: string;
  refesId: string | null;
  hash: string | null;
  previousLogId: string | null;
  ip: string | null;
  metadata: Record<string, any> | null;
  createdAt: string | Date;
}

const ACTION_MAP: Record<string, AuditEvent['action']> = {
  read: 'R',
  write: 'C',
  export: 'R',
  grant: 'C',
  login: 'E',
  logout: 'E',
  deny: 'E',
  execute: 'E',
};

const PURPOSE_MAP: Record<string, { code: string; display: string }> = {
  treatment: { code: 'TREAT', display: 'treatment' },
  billing: { code: 'HPAYMT', display: 'healthcare payment' },
  emergency: { code: 'BTG', display: 'break the glass' },
  operations: { code: 'HOPERAT', display: 'healthcare operations' },
  share: { code: 'HDIRECT', display: 'directory' },
};

const RESOURCE_TYPE_MAP: Record<string, { code: string; display: string }> = {
  encounters: { code: 'rest', display: 'RESTful Operation' },
  studies: { code: 'rest', display: 'RESTful Operation' },
  prescriptions: { code: 'rest', display: 'RESTful Operation' },
  'shared-access': { code: 'rest', display: 'RESTful Operation' },
  authentication: { code: '110114', display: 'User Authentication' },
  'access-control': { code: '110113', display: 'Security Alert' },
  configuration: { code: '110128', display: 'Application Activity' },
  system: { code: '110128', display: 'Application Activity' },
  'user-management': { code: '110136', display: 'Security Roles Changed' },
};

const RESOURCE_SUBTYPE_MAP: Record<string, { code: string; display: string }> = {
  encounters: { code: 'Encounter', display: 'Encounter' },
  studies: { code: 'DiagnosticReport', display: 'DiagnosticReport' },
  prescriptions: { code: 'MedicationRequest', display: 'MedicationRequest' },
  'shared-access': { code: 'Consent', display: 'Consent' },
};

export function mapAuditEvent(log: InternalAccessLog): AuditEvent {
  const purposeInfo = PURPOSE_MAP[log.purpose] || PURPOSE_MAP.treatment;
  const typeInfo = RESOURCE_TYPE_MAP[log.resource] || RESOURCE_TYPE_MAP.encounters;
  const subtypeInfo = RESOURCE_SUBTYPE_MAP[log.resource];

  const purposeOfEvent: CodeableConcept[] = [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
      code: purposeInfo.code,
      display: purposeInfo.display,
    }],
  }];

  // Primary agent: the user who performed the action
  const agents: AuditEventAgent[] = [{
    who: log.userId
      ? { reference: `Practitioner/${log.userId}` }
      : { display: 'System' },
    requestor: true,
    network: log.ip ? {
      address: log.ip,
      type: '2', // IP Address
    } : undefined,
  }];

  // Secondary agent for share events (the receiving medic)
  if (log.purpose === 'share' && log.metadata?.grantedMedicId) {
    agents.push({
      who: {
        reference: `Practitioner/${log.metadata.grantedMedicId}`,
      },
      requestor: false,
    });
  }

  // Entity: the patient whose data was accessed
  const entity: AuditEventEntity[] = [];
  if (log.patientId) {
    entity.push({
      what: {
        reference: `Patient/${log.patientId}`,
      },
      type: {
        system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
        code: '1',
        display: 'Person',
      },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '1',
        display: 'Patient',
      },
    });
  }

  // Add hash chain detail if present
  if (log.hash) {
    const chainEntity: AuditEventEntity = {
      what: {
        reference: `AuditEvent/${log.id}`,
      },
      type: {
        system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
        code: '4',
        display: 'Other',
      },
      detail: [
        {
          type: 'hash',
          valueString: log.hash,
        },
      ],
    };

    if (log.previousLogId) {
      chainEntity.detail!.push({
        type: 'previousLogId',
        valueString: log.previousLogId,
      });
    }

    entity.push(chainEntity);
  }

  // Override type for system startup/shutdown events
  let resolvedTypeInfo = typeInfo;
  if (log.resource === 'system' && log.metadata?.event === 'startup') {
    resolvedTypeInfo = { code: '110120', display: 'Application Start' };
  } else if (log.resource === 'system' && log.metadata?.event === 'shutdown') {
    resolvedTypeInfo = { code: '110121', display: 'Application Stop' };
  }

  // Determine outcome: '0' = success, '8' = serious failure (for denials)
  const outcome = log.action === 'deny' ? '8' : '0';

  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    id: log.id,
    type: {
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      code: resolvedTypeInfo.code,
      display: resolvedTypeInfo.display,
    },
    recorded: new Date(log.createdAt).toISOString(),
    action: ACTION_MAP[log.action] || 'R',
    outcome,
    purposeOfEvent,
    agent: agents,
    source: {
      site: log.refesId || undefined,
      observer: log.organizationId
        ? { reference: `Organization/${log.organizationId}` }
        : { display: 'Athelas', identifier: { system: DOMAIN_SYSTEM, value: 'athelas' } },
    },
    entity: entity.length > 0 ? entity : undefined,
  };

  if (subtypeInfo) {
    auditEvent.subtype = [{
      system: 'http://hl7.org/fhir/resource-types',
      code: subtypeInfo.code,
      display: subtypeInfo.display,
    }];
  } else if (log.resource === 'authentication') {
    const authSubtype = log.action === 'login'
      ? { code: '110122', display: 'Login' }
      : log.action === 'logout'
        ? { code: '110123', display: 'Logout' }
        : { code: '110124', display: 'Attach' };
    auditEvent.subtype = [{
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      code: authSubtype.code,
      display: authSubtype.display,
    }];
  }

  return auditEvent;
}
