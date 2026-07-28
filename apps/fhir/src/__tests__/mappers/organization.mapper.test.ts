import assert from 'assert';
import { mapOrganization, canonicalOrganizationId } from '../../mappers/organization.mapper';

describe('Organization Mapper', () => {
  const baseOrg = {
    id: 'org-uuid-123',
    name: 'Hospital Joaquín Corvalán',
    slug: 'hospital-corvalan',
    settings: { refesId: 'REFES-00001' },
    isActive: true,
  };

  it('should map a complete organization to Organization-ar-core', () => {
    const result = mapOrganization(baseOrg);

    assert.strictEqual(result.resourceType, 'Organization');
    // Canonical resource id derives from the REFES code so tenant orgs
    // sharing an establishment dedupe into one resource
    assert.strictEqual(result.id, 'refes-REFES-00001');
    assert.strictEqual(result.name, 'Hospital Joaquín Corvalán');
    assert.strictEqual(result.active, true);
  });

  it('should keep the row id when there is no REFES id', () => {
    const noRefes = { ...baseOrg, settings: {} };
    assert.strictEqual(mapOrganization(noRefes).id, 'org-uuid-123');
    assert.strictEqual(canonicalOrganizationId(noRefes), 'org-uuid-123');
    assert.strictEqual(canonicalOrganizationId(baseOrg), 'refes-REFES-00001');
  });

  it('should prefer the official REFES name when provided', () => {
    const result = mapOrganization(baseOrg, 'HOSPITAL GENERAL JOAQUÍN CORVALÁN');
    assert.strictEqual(result.name, 'HOSPITAL GENERAL JOAQUÍN CORVALÁN');
    assert.ok(result.text?.div?.includes('HOSPITAL GENERAL JOAQUÍN CORVALÁN'));
  });

  it('should include AR.FHIR.CORE profile', () => {
    const result = mapOrganization(baseOrg);
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Organization-ar-core'));
  });

  it('should include a single REFES identifier with use=usual (AR profile)', () => {
    const result = mapOrganization(baseOrg);
    // Organization-ar-core allows exactly one identifier (REFES, use fixed to 'usual')
    assert.strictEqual(result.identifier?.length, 1);
    const refes = result.identifier![0];
    assert.strictEqual(refes.system, 'http://refes.msal.gob.ar');
    assert.strictEqual(refes.value, 'REFES-00001');
    assert.strictEqual(refes.use, 'usual');
  });

  it('should fall back to the domain identifier without REFES ID', () => {
    const noRefes = { ...baseOrg, settings: {} };
    const result = mapOrganization(noRefes);
    assert.strictEqual(result.identifier?.length, 1);
    const domain = result.identifier![0];
    assert.strictEqual(domain.use, 'usual');
    assert.strictEqual(domain.value, 'org-uuid-123');
  });

  it('should handle inactive organization', () => {
    const inactive = { ...baseOrg, isActive: false };
    const result = mapOrganization(inactive);
    assert.strictEqual(result.active, false);
  });
});
