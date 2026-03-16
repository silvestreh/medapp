import assert from 'assert';
import { mapAuditEvent } from '../../mappers/audit-event.mapper';

describe('AuditEvent Mapper', () => {
  const baseLog = {
    id: 'log-uuid-123',
    userId: 'user-uuid-456',
    organizationId: 'org-uuid-789',
    resource: 'encounters',
    patientId: 'patient-uuid-012',
    action: 'read',
    purpose: 'treatment',
    refesId: 'REFES-00001',
    hash: 'abc123def456'.padEnd(64, '0'),
    previousLogId: 'log-uuid-prev',
    ip: '192.168.1.1',
    metadata: null,
    createdAt: '2025-03-15T10:30:00.000Z',
  };

  it('should map a basic access log to AuditEvent', () => {
    const result = mapAuditEvent(baseLog);

    assert.strictEqual(result.resourceType, 'AuditEvent');
    assert.strictEqual(result.id, 'log-uuid-123');
    assert.strictEqual(result.recorded, '2025-03-15T10:30:00.000Z');
    assert.strictEqual(result.action, 'R');
    assert.strictEqual(result.outcome, '0');
  });

  it('should map action codes correctly', () => {
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'read' }).action, 'R');
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'write' }).action, 'C');
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'export' }).action, 'R');
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'grant' }).action, 'C');
  });

  it('should map purpose to V3 PurposeOfUse codes', () => {
    const treatment = mapAuditEvent({ ...baseLog, purpose: 'treatment' });
    assert.strictEqual(treatment.purposeOfEvent?.[0]?.coding?.[0]?.code, 'TREAT');

    const billing = mapAuditEvent({ ...baseLog, purpose: 'billing' });
    assert.strictEqual(billing.purposeOfEvent?.[0]?.coding?.[0]?.code, 'HPAYMT');

    const emergency = mapAuditEvent({ ...baseLog, purpose: 'emergency' });
    assert.strictEqual(emergency.purposeOfEvent?.[0]?.coding?.[0]?.code, 'BTG');

    const operations = mapAuditEvent({ ...baseLog, purpose: 'operations' });
    assert.strictEqual(operations.purposeOfEvent?.[0]?.coding?.[0]?.code, 'HOPERAT');

    const share = mapAuditEvent({ ...baseLog, purpose: 'share' });
    assert.strictEqual(share.purposeOfEvent?.[0]?.coding?.[0]?.code, 'HDIRECT');
  });

  it('should include primary agent with practitioner reference and IP', () => {
    const result = mapAuditEvent(baseLog);

    assert.strictEqual(result.agent?.[0]?.who?.reference, 'Practitioner/user-uuid-456');
    assert.strictEqual(result.agent?.[0]?.requestor, true);
    assert.strictEqual(result.agent?.[0]?.network?.address, '192.168.1.1');
    assert.strictEqual(result.agent?.[0]?.network?.type, '2');
  });

  it('should include secondary agent for share events with grantedMedicId', () => {
    const shareLog = {
      ...baseLog,
      purpose: 'share',
      metadata: { grantedMedicId: 'medic-uuid-granted' },
    };
    const result = mapAuditEvent(shareLog);

    assert.strictEqual(result.agent?.length, 2);
    assert.strictEqual(result.agent?.[1]?.who?.reference, 'Practitioner/medic-uuid-granted');
    assert.strictEqual(result.agent?.[1]?.requestor, false);
  });

  it('should include patient entity when patientId is present', () => {
    const result = mapAuditEvent(baseLog);
    const patientEntity = result.entity?.find(e => e.what?.reference === 'Patient/patient-uuid-012');

    assert.ok(patientEntity);
    assert.strictEqual(patientEntity?.type?.code, '1');
    assert.strictEqual(patientEntity?.role?.code, '1');
  });

  it('should omit patient entity when patientId is null', () => {
    const noPatient = { ...baseLog, patientId: null, hash: null, previousLogId: null };
    const result = mapAuditEvent(noPatient);

    assert.strictEqual(result.entity, undefined);
  });

  it('should include hash chain detail when hash is present', () => {
    const result = mapAuditEvent(baseLog);
    const chainEntity = result.entity?.find(e => e.detail?.some(d => d.type === 'hash'));

    assert.ok(chainEntity);
    assert.strictEqual(chainEntity?.detail?.[0]?.type, 'hash');
    assert.strictEqual(chainEntity?.detail?.[0]?.valueString, baseLog.hash);
    assert.strictEqual(chainEntity?.detail?.[1]?.type, 'previousLogId');
    assert.strictEqual(chainEntity?.detail?.[1]?.valueString, 'log-uuid-prev');
  });

  it('should include organization reference in source', () => {
    const result = mapAuditEvent(baseLog);

    assert.strictEqual(result.source?.observer?.reference, 'Organization/org-uuid-789');
    assert.strictEqual(result.source?.site, 'REFES-00001');
  });

  it('should handle missing organization gracefully', () => {
    const noOrg = { ...baseLog, organizationId: null, refesId: null };
    const result = mapAuditEvent(noOrg);

    assert.ok(result.source?.observer?.display);
    assert.strictEqual(result.source?.site, undefined);
  });

  it('should map new action codes correctly', () => {
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'login' }).action, 'E');
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'logout' }).action, 'E');
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'deny' }).action, 'E');
    assert.strictEqual(mapAuditEvent({ ...baseLog, action: 'execute' }).action, 'E');
  });

  it('should set outcome to 8 for deny actions', () => {
    const denial = mapAuditEvent({ ...baseLog, action: 'deny', resource: 'access-control' });
    assert.strictEqual(denial.outcome, '8');
  });

  it('should set outcome to 0 for non-deny actions', () => {
    const login = mapAuditEvent({ ...baseLog, action: 'login', resource: 'authentication' });
    assert.strictEqual(login.outcome, '0');
  });

  it('should map authentication events with subtypes', () => {
    const login = mapAuditEvent({ ...baseLog, resource: 'authentication', action: 'login' });
    assert.strictEqual(login.type?.code, '110114');
    assert.strictEqual(login.subtype?.[0]?.code, '110122');

    const logout = mapAuditEvent({ ...baseLog, resource: 'authentication', action: 'logout' });
    assert.strictEqual(logout.subtype?.[0]?.code, '110123');
  });

  it('should map system startup event', () => {
    const startup = mapAuditEvent({
      ...baseLog,
      userId: null,
      resource: 'system',
      action: 'execute',
      metadata: { event: 'startup' },
    });
    assert.strictEqual(startup.type?.code, '110120');
    assert.strictEqual(startup.type?.display, 'Application Start');
    assert.strictEqual(startup.agent?.[0]?.who?.display, 'System');
  });

  it('should map system shutdown event', () => {
    const shutdown = mapAuditEvent({
      ...baseLog,
      userId: null,
      resource: 'system',
      action: 'execute',
      metadata: { event: 'shutdown' },
    });
    assert.strictEqual(shutdown.type?.code, '110121');
    assert.strictEqual(shutdown.type?.display, 'Application Stop');
  });

  it('should map access-control denial event', () => {
    const denial = mapAuditEvent({ ...baseLog, resource: 'access-control', action: 'deny' });
    assert.strictEqual(denial.type?.code, '110113');
    assert.strictEqual(denial.type?.display, 'Security Alert');
  });

  it('should map user-management event', () => {
    const roleChange = mapAuditEvent({ ...baseLog, resource: 'user-management', action: 'write' });
    assert.strictEqual(roleChange.type?.code, '110136');
    assert.strictEqual(roleChange.type?.display, 'Security Roles Changed');
  });

  it('should map configuration event', () => {
    const config = mapAuditEvent({ ...baseLog, resource: 'configuration', action: 'write' });
    assert.strictEqual(config.type?.code, '110128');
    assert.strictEqual(config.type?.display, 'Application Activity');
  });

  it('should handle null userId gracefully', () => {
    const result = mapAuditEvent({ ...baseLog, userId: null });
    assert.strictEqual(result.agent?.[0]?.who?.display, 'System');
    assert.strictEqual(result.agent?.[0]?.requestor, true);
  });

  it('should include subtype for resource types', () => {
    const encounters = mapAuditEvent({ ...baseLog, resource: 'encounters' });
    assert.strictEqual(encounters.subtype?.[0]?.code, 'Encounter');

    const studies = mapAuditEvent({ ...baseLog, resource: 'studies' });
    assert.strictEqual(studies.subtype?.[0]?.code, 'DiagnosticReport');

    const prescriptions = mapAuditEvent({ ...baseLog, resource: 'prescriptions' });
    assert.strictEqual(prescriptions.subtype?.[0]?.code, 'MedicationRequest');

    const sharedAccess = mapAuditEvent({ ...baseLog, resource: 'shared-access' });
    assert.strictEqual(sharedAccess.subtype?.[0]?.code, 'Consent');
  });
});
