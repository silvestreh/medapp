import assert from 'assert';
import { computeAccessLogHash } from '../../src/services/access-logs/hooks/access-log-hash';

describe('computeAccessLogHash', () => {
  const baseLog = {
    id: 'log-id-1',
    userId: 'user-1',
    organizationId: 'org-1',
    resource: 'encounters',
    patientId: 'patient-1',
    action: 'read',
    purpose: 'treatment',
    refesId: 'REFES-001',
    ip: '127.0.0.1',
    metadata: null,
  };

  it('returns a 64-char hex string', () => {
    const hash = computeAccessLogHash(baseLog, null);
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const hash2 = computeAccessLogHash(baseLog, null);
    assert.strictEqual(hash1, hash2);
  });

  it('changes when action changes', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const modified = { ...baseLog, action: 'write' };
    const hash2 = computeAccessLogHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when previousHash changes', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const hash2 = computeAccessLogHash(baseLog, 'abc123');
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when purpose changes', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const modified = { ...baseLog, purpose: 'emergency' };
    const hash2 = computeAccessLogHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when userId changes', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const modified = { ...baseLog, userId: 'other-user' };
    const hash2 = computeAccessLogHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when resource changes', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const modified = { ...baseLog, resource: 'studies' };
    const hash2 = computeAccessLogHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when metadata changes', () => {
    const hash1 = computeAccessLogHash(baseLog, null);
    const modified = { ...baseLog, metadata: { grantedMedicId: 'medic-2' } };
    const hash2 = computeAccessLogHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('handles null patientId', () => {
    const withNull = computeAccessLogHash({ ...baseLog, patientId: null }, null);
    assert.ok(withNull, 'Produces a hash with null patientId');
    assert.notStrictEqual(withNull, computeAccessLogHash(baseLog, null));
  });

  it('handles null organizationId', () => {
    const withNull = computeAccessLogHash({ ...baseLog, organizationId: null }, null);
    assert.ok(withNull, 'Produces a hash with null organizationId');
  });

  it('handles null refesId', () => {
    const withNull = computeAccessLogHash({ ...baseLog, refesId: null }, null);
    assert.ok(withNull, 'Produces a hash with null refesId');
    assert.notStrictEqual(withNull, computeAccessLogHash(baseLog, null));
  });
});
