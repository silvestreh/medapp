import assert from 'assert';
import { dedupeOrganizationRows, collectRefesIds } from '../../utils/organization-dedupe';

describe('Organization dedupe', () => {
  const rows = [
    { id: 'org-1', name: 'Consultorio Dr. Pérez', slug: 'perez', settings: { refesId: '10000012345678' }, isActive: false },
    { id: 'org-2', name: 'Consultorio Dra. García', slug: 'garcia', settings: { refesId: '10000012345678' }, isActive: true },
    { id: 'org-3', name: 'Clínica Sur', slug: 'sur', settings: { refesId: '20000099999999' }, isActive: true },
    { id: 'org-4', name: 'Sin REFES', slug: 'sin-refes', settings: {}, isActive: true },
  ];

  it('collapses rows sharing a REFES id', () => {
    const result = dedupeOrganizationRows(rows);
    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(result.map((r) => r.id), ['org-1', 'org-3', 'org-4']);
  });

  it('marks the canonical row active if any tenant is active', () => {
    const result = dedupeOrganizationRows(rows);
    const shared = result.find((r) => r.settings.refesId === '10000012345678');
    assert.strictEqual(shared!.isActive, true);
  });

  it('does not mutate the input rows', () => {
    dedupeOrganizationRows(rows);
    assert.strictEqual(rows[0].isActive, false);
  });

  it('passes through rows without REFES id', () => {
    const result = dedupeOrganizationRows(rows);
    assert.ok(result.some((r) => r.id === 'org-4'));
  });

  it('collects unique REFES ids', () => {
    assert.deepStrictEqual(collectRefesIds(rows), ['10000012345678', '20000099999999']);
  });
});
