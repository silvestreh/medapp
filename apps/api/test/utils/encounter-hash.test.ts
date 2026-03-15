import assert from 'assert';
import { computeEncounterHash } from '../../src/services/encounters/hooks/encounter-hash';

describe('computeEncounterHash', () => {
  const baseEncounter = {
    id: 'test-id-1',
    patientId: 'patient-1',
    medicId: 'medic-1',
    date: '2025-01-15T10:00:00.000Z',
    insurerId: null,
    data: { notes: { values: { text: 'test' } } },
  };

  it('returns a 64-char hex string', () => {
    const hash = computeEncounterHash(baseEncounter, null);
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const hash1 = computeEncounterHash(baseEncounter, null);
    const hash2 = computeEncounterHash(baseEncounter, null);
    assert.strictEqual(hash1, hash2);
  });

  it('changes when data changes', () => {
    const hash1 = computeEncounterHash(baseEncounter, null);
    const modified = { ...baseEncounter, data: { notes: { values: { text: 'different' } } } };
    const hash2 = computeEncounterHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when previousHash changes', () => {
    const hash1 = computeEncounterHash(baseEncounter, null);
    const hash2 = computeEncounterHash(baseEncounter, 'abc123');
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when date changes', () => {
    const hash1 = computeEncounterHash(baseEncounter, null);
    const modified = { ...baseEncounter, date: '2025-02-01T10:00:00.000Z' };
    const hash2 = computeEncounterHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when medicId changes', () => {
    const hash1 = computeEncounterHash(baseEncounter, null);
    const modified = { ...baseEncounter, medicId: 'other-medic' };
    const hash2 = computeEncounterHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('changes when id changes', () => {
    const hash1 = computeEncounterHash(baseEncounter, null);
    const modified = { ...baseEncounter, id: 'different-id' };
    const hash2 = computeEncounterHash(modified, null);
    assert.notStrictEqual(hash1, hash2);
  });

  it('normalizes Date objects to ISO strings', () => {
    const withString = computeEncounterHash(baseEncounter, null);
    const withDate = computeEncounterHash(
      { ...baseEncounter, date: new Date('2025-01-15T10:00:00.000Z') },
      null
    );
    assert.strictEqual(withString, withDate);
  });

  it('handles string data (pre-parsed JSON)', () => {
    const withObject = computeEncounterHash(baseEncounter, null);
    const withString = computeEncounterHash(
      { ...baseEncounter, data: JSON.stringify(baseEncounter.data) },
      null
    );
    assert.strictEqual(withObject, withString);
  });
});
