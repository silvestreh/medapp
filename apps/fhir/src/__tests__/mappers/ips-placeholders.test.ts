import assert from 'assert';
import { mapNoKnownProblems } from '../../mappers/condition.mapper';
import { mapNoKnownAllergies } from '../../mappers/allergy-intolerance.mapper';
import { mapNoKnownMedications } from '../../mappers/medication-statement.mapper';

const ABSENT_UNKNOWN_SYSTEM = 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips';

describe('IPS Absent/Unknown Placeholders', () => {
  const patientId = 'patient-001';

  it('should build a no-known-problems Condition', () => {
    const result = mapNoKnownProblems(patientId);
    assert.strictEqual(result.resourceType, 'Condition');
    assert.strictEqual(result.code?.coding?.[0].system, ABSENT_UNKNOWN_SYSTEM);
    assert.strictEqual(result.code?.coding?.[0].code, 'no-known-problems');
    assert.strictEqual(result.subject?.reference, `Patient/${patientId}`);
    assert.strictEqual(result.text?.status, 'generated');
  });

  it('should build a no-known-allergies AllergyIntolerance', () => {
    const result = mapNoKnownAllergies(patientId);
    assert.strictEqual(result.resourceType, 'AllergyIntolerance');
    assert.strictEqual(result.code?.coding?.[0].code, 'no-known-allergies');
    assert.strictEqual(result.patient?.reference, `Patient/${patientId}`);
  });

  it('should build a no-known-medications MedicationStatement with absent effective[x]', () => {
    const result = mapNoKnownMedications(patientId);
    assert.strictEqual(result.resourceType, 'MedicationStatement');
    assert.strictEqual(result.status, 'unknown');
    assert.strictEqual(result.medicationCodeableConcept?.coding?.[0].code, 'no-known-medications');
    const primitiveExt = (result as { _effectiveDateTime?: { extension: { url: string }[] } })._effectiveDateTime;
    assert.strictEqual(primitiveExt?.extension[0].url, 'http://hl7.org/fhir/StructureDefinition/data-absent-reason');
  });
});
