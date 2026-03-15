import assert from 'assert';
import type { Composition } from '@medplum/fhirtypes';
import { mapIpsBundle } from '../../mappers/bundle.mapper';

describe('Bundle Mapper', () => {
  const mockComposition: Composition = {
    resourceType: 'Composition',
    id: 'comp-1',
    status: 'final',
    type: { coding: [{ system: 'http://loinc.org', code: '60591-5' }] },
    date: '2024-01-15',
    author: [{ reference: 'Practitioner/medic-1' }],
    title: 'Resumen del Paciente',
  };

  const baseInput = {
    composition: mockComposition,
    patient: { resourceType: 'Patient' as const, id: 'patient-1' },
    practitioner: { resourceType: 'Practitioner' as const, id: 'medic-1' },
    organization: { resourceType: 'Organization' as const, id: 'org-1' },
    conditions: [{ resourceType: 'Condition', id: 'cond-1' }],
    allergies: [{ resourceType: 'AllergyIntolerance', id: 'allergy-1' }],
    medications: [{ resourceType: 'MedicationStatement', id: 'med-1' }],
  };

  it('should create a document bundle', () => {
    const result = mapIpsBundle(baseInput);
    assert.strictEqual(result.resourceType, 'Bundle');
    assert.strictEqual(result.type, 'document');
    assert.strictEqual(result.language, 'es-AR');
    assert.ok(result.timestamp);
    assert.ok(result.identifier?.value);
  });

  it('should include AR.FHIR.CORE bundle profile', () => {
    const result = mapIpsBundle(baseInput);
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Bundle-ar-ips-core'));
  });

  it('should have Composition as first entry', () => {
    const result = mapIpsBundle(baseInput);
    assert.strictEqual(result.entry?.[0].resource?.resourceType, 'Composition');
  });

  it('should have at least 6 entries (AR minimum)', () => {
    const result = mapIpsBundle(baseInput);
    // Composition + Patient + Practitioner + Organization + 1 Condition + 1 Allergy + 1 Med = 7
    assert.ok((result.entry?.length || 0) >= 6);
  });

  it('should include all clinical resources', () => {
    const result = mapIpsBundle(baseInput);
    const types = result.entry?.map(e => e.resource?.resourceType) || [];
    assert.ok(types.includes('Composition'));
    assert.ok(types.includes('Patient'));
    assert.ok(types.includes('Practitioner'));
    assert.ok(types.includes('Organization'));
    assert.ok(types.includes('Condition'));
    assert.ok(types.includes('AllergyIntolerance'));
    assert.ok(types.includes('MedicationStatement'));
  });

  it('should work with no clinical resources (min 4 entries)', () => {
    const minimal = {
      ...baseInput,
      conditions: [],
      allergies: [],
      medications: [],
    };
    const result = mapIpsBundle(minimal);
    // Composition + Patient + Practitioner + Organization = 4
    assert.strictEqual(result.entry?.length, 4);
  });
});
