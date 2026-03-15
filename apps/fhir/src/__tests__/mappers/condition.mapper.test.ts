import assert from 'assert';
import { mapCondition, mapConditions } from '../../mappers/condition.mapper';

describe('Condition Mapper', () => {
  const context = {
    encounterId: 'enc-001',
    patientId: 'patient-001',
    medicId: 'medic-001',
    encounterDate: '2024-01-15T10:00:00Z',
  };

  const icdLookup: Record<string, string> = {
    'I10': 'Hipertensión esencial (primaria)',
    'E11': 'Diabetes mellitus tipo 2',
  };

  it('should map a condition with ICD-10 code', () => {
    const result = mapCondition(
      { issueId: 'I10', date: new Date('2023-06-01'), description: 'Diagnosticada en 2023' },
      context,
      0,
      icdLookup
    );

    assert.strictEqual(result.resourceType, 'Condition');
    assert.strictEqual(result.code?.coding?.[0].system, 'http://hl7.org/fhir/sid/icd-10');
    assert.strictEqual(result.code?.coding?.[0].code, 'I10');
    assert.strictEqual(result.code?.coding?.[0].display, 'Hipertensión esencial (primaria)');
    assert.strictEqual(result.subject?.reference, 'Patient/patient-001');
    assert.strictEqual(result.recorder?.reference, 'Practitioner/medic-001');
    assert.strictEqual(result.onsetDateTime, '2023-06-01');
    assert.strictEqual(result.note?.[0].text, 'Diagnosticada en 2023');
  });

  it('should handle condition without date or description', () => {
    const result = mapCondition(
      { issueId: 'E11', date: null, description: '' },
      context,
      1,
      icdLookup
    );

    assert.strictEqual(result.code?.coding?.[0].code, 'E11');
    assert.strictEqual(result.onsetDateTime, undefined);
    assert.strictEqual(result.note, undefined);
  });

  it('should handle unknown ICD code (no display)', () => {
    const result = mapCondition(
      { issueId: 'Z99.9', date: null, description: '' },
      context,
      0,
      icdLookup
    );

    assert.strictEqual(result.code?.coding?.[0].code, 'Z99.9');
    assert.strictEqual(result.code?.coding?.[0].display, undefined);
  });

  it('should map multiple conditions', () => {
    const items = [
      { issueId: 'I10', date: null, description: '' },
      { issueId: 'E11', date: null, description: '' },
    ];
    const results = mapConditions(items, context, icdLookup);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'enc-001-condition-0');
    assert.strictEqual(results[1].id, 'enc-001-condition-1');
  });
});
