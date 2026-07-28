import assert from 'assert';
import { mapComposition } from '../../mappers/composition.mapper';

describe('Composition Mapper', () => {
  const baseInput = {
    patientId: 'patient-001',
    authorIdentifier: { system: 'http://refes.msal.gob.ar', value: '10000012345678' },
    custodianIdentifier: { system: 'http://federador.msal.gob.ar/uri', value: 'http://athelas.app/fhir' },
    conditions: [] as { resourceType: string; id?: string }[],
    allergies: [] as { resourceType: string; id?: string }[],
    medications: [] as { resourceType: string; id?: string }[],
  };

  it('should create an IPS composition with 4 mandatory sections', () => {
    const result = mapComposition(baseInput);

    assert.strictEqual(result.resourceType, 'Composition');
    assert.strictEqual(result.status, 'final');
    assert.strictEqual(result.language, 'es-AR');
    assert.strictEqual(result.subject?.reference, 'Patient/patient-001');
    assert.strictEqual(result.section?.length, 4);
  });

  it('should use logical identifiers (no references) for author and custodian', () => {
    const result = mapComposition(baseInput);

    // Composition-ar-ips-core forbids author/custodian references (0..0):
    // author is the institution (REFES), custodian is the federador domain
    assert.strictEqual(result.author?.[0].reference, undefined);
    assert.strictEqual(result.author?.[0].identifier?.system, 'http://refes.msal.gob.ar');
    assert.strictEqual(result.author?.[0].identifier?.value, '10000012345678');
    assert.strictEqual(result.custodian?.reference, undefined);
    assert.strictEqual(result.custodian?.identifier?.system, 'http://federador.msal.gob.ar/uri');
    assert.strictEqual(result.custodian?.identifier?.value, 'http://athelas.app/fhir');
  });

  it('should include AR.FHIR.CORE profile', () => {
    const result = mapComposition(baseInput);
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Composition-ar-ips-core'));
  });

  it('should have a resource-level narrative', () => {
    const result = mapComposition(baseInput);
    assert.strictEqual(result.text?.status, 'generated');
    assert.ok(result.text?.div?.includes('Resumen del Paciente'));
  });

  it('should not include display on LOINC codings (es-AR terminology rule)', () => {
    const result = mapComposition(baseInput);
    assert.strictEqual(result.type?.coding?.[0].display, undefined);
    for (const section of result.section || []) {
      assert.strictEqual(section.code?.coding?.[0].display, undefined);
    }
  });

  it('should have immunizations section with emptyReason unavailable', () => {
    const result = mapComposition(baseInput);
    const immunizations = result.section?.find(s => s.code?.coding?.[0].code === '11369-6');
    assert.ok(immunizations);
    assert.strictEqual(immunizations!.emptyReason?.coding?.[0].code, 'unavailable');
    assert.strictEqual(immunizations!.entry, undefined);
  });

  it('should have conditions section with emptyReason when no conditions', () => {
    const result = mapComposition(baseInput);
    const conditions = result.section?.find(s => s.code?.coding?.[0].code === '11450-4');
    assert.ok(conditions);
    assert.strictEqual(conditions!.emptyReason?.coding?.[0].code, 'nilknown');
  });

  it('should reference conditions when present', () => {
    const conditions = [
      { resourceType: 'Condition' as const, id: 'cond-1' },
      { resourceType: 'Condition' as const, id: 'cond-2' },
    ];
    const result = mapComposition({ ...baseInput, conditions });
    const condSection = result.section?.find(s => s.code?.coding?.[0].code === '11450-4');
    assert.strictEqual(condSection!.entry?.length, 2);
    assert.strictEqual(condSection!.entry?.[0].reference, 'Condition/cond-1');
    assert.strictEqual(condSection!.emptyReason, undefined);
  });
});
