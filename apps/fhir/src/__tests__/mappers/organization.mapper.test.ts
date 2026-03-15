import assert from 'assert';
import { mapOrganization } from '../../mappers/organization.mapper';

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
    assert.strictEqual(result.id, 'org-uuid-123');
    assert.strictEqual(result.name, 'Hospital Joaquín Corvalán');
    assert.strictEqual(result.active, true);
  });

  it('should include AR.FHIR.CORE profile', () => {
    const result = mapOrganization(baseOrg);
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Organization-ar-core'));
  });

  it('should include REFES identifier when available', () => {
    const result = mapOrganization(baseOrg);
    const refes = result.identifier?.find(i => i.system === 'http://refes.msal.gob.ar');
    assert.ok(refes);
    assert.strictEqual(refes!.value, 'REFES-00001');
    assert.strictEqual(refes!.use, 'official');
  });

  it('should always include domain identifier', () => {
    const result = mapOrganization(baseOrg);
    const domain = result.identifier?.find(i => i.use === 'usual');
    assert.ok(domain);
    assert.strictEqual(domain!.value, 'org-uuid-123');
  });

  it('should handle organization without REFES ID', () => {
    const noRefes = { ...baseOrg, settings: {} };
    const result = mapOrganization(noRefes);
    const refes = result.identifier?.find(i => i.system === 'http://refes.msal.gob.ar');
    assert.strictEqual(refes, undefined);
    // Should still have domain identifier
    assert.strictEqual(result.identifier?.length, 1);
  });

  it('should handle inactive organization', () => {
    const inactive = { ...baseOrg, isActive: false };
    const result = mapOrganization(inactive);
    assert.strictEqual(result.active, false);
  });
});
