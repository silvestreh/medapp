import assert from 'assert';
import { mapComposition } from '../../mappers/composition.mapper';

describe('Composition Mapper', () => {
  it('should create an IPS composition with 4 mandatory sections', () => {
    const result = mapComposition({
      patientId: 'patient-001',
      practitionerId: 'medic-001',
      organizationId: 'org-001',
      conditions: [],
      allergies: [],
      medications: [],
    });

    assert.strictEqual(result.resourceType, 'Composition');
    assert.strictEqual(result.status, 'final');
    assert.strictEqual(result.language, 'es-AR');
    assert.strictEqual(result.subject?.reference, 'Patient/patient-001');
    assert.strictEqual(result.author?.[0].reference, 'Practitioner/medic-001');
    assert.strictEqual(result.custodian?.reference, 'Organization/org-001');
    assert.strictEqual(result.section?.length, 4);
  });

  it('should include AR.FHIR.CORE profile', () => {
    const result = mapComposition({
      patientId: 'p1', practitionerId: 'm1', organizationId: 'o1',
      conditions: [], allergies: [], medications: [],
    });
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Composition-ar-ips-core'));
  });

  it('should have immunizations section with emptyReason', () => {
    const result = mapComposition({
      patientId: 'p1', practitionerId: 'm1', organizationId: 'o1',
      conditions: [], allergies: [], medications: [],
    });
    const immunizations = result.section?.find(s => s.code?.coding?.[0].code === '11369-6');
    assert.ok(immunizations);
    assert.strictEqual(immunizations!.emptyReason?.coding?.[0].code, 'unavailable');
  });

  it('should have conditions section with emptyReason when no conditions', () => {
    const result = mapComposition({
      patientId: 'p1', practitionerId: 'm1', organizationId: 'o1',
      conditions: [], allergies: [], medications: [],
    });
    const conditions = result.section?.find(s => s.code?.coding?.[0].code === '11450-4');
    assert.ok(conditions);
    assert.strictEqual(conditions!.emptyReason?.coding?.[0].code, 'nilknown');
  });

  it('should reference conditions when present', () => {
    const conditions = [
      { resourceType: 'Condition' as const, id: 'cond-1' },
      { resourceType: 'Condition' as const, id: 'cond-2' },
    ];
    const result = mapComposition({
      patientId: 'p1', practitionerId: 'm1', organizationId: 'o1',
      conditions, allergies: [], medications: [],
    });
    const condSection = result.section?.find(s => s.code?.coding?.[0].code === '11450-4');
    assert.strictEqual(condSection!.entry?.length, 2);
    assert.strictEqual(condSection!.entry?.[0].reference, 'Condition/cond-1');
    assert.strictEqual(condSection!.emptyReason, undefined);
  });
});
