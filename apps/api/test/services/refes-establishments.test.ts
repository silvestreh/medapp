import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

const FIXTURES = [
  {
    id: '10000012345678',
    name: 'HOSPITAL GENERAL SAN MARTÍN',
    province: 'BUENOS AIRES',
    provinceId: '06',
    department: 'LA PLATA',
    departmentId: '441',
    city: 'LA PLATA',
    cityId: '06441030000',
    postalCode: '1900',
    address: 'CALLE 1 Y 70',
    website: null,
    financing: 'Público',
    typologyId: '1',
    typologyAcronym: 'ESCI',
    typologyName: 'Establecimiento de salud con internación general',
    longitude: '-57.9', latitude: '-34.9',
  },
  {
    id: '52500282358948',
    name: 'CONSULTORIO DRA GONZÁLEZ',
    province: 'MENDOZA',
    provinceId: '50',
    department: 'GUAYMALLÉN',
    departmentId: '028',
    city: 'VILLA NUEVA',
    cityId: '50028020014',
    postalCode: '5521',
    address: 'REPÚBLICA DE SIRIA 3454',
    website: null,
    financing: 'Privado',
    typologyId: '52',
    typologyAcronym: 'ESSIT',
    typologyName: 'Centro educativo terapéutico',
    longitude: '-68.8', latitude: '-32.9',
  },
];

describe('refes-establishments service', () => {
  before(async () => {
    await app.service('refes-establishments').remove(null, { query: {} });
    await app.service('refes-establishments').create(FIXTURES);
  });

  after(async () => {
    await app.service('refes-establishments').remove(null, { query: {} });
  });

  it('registered the service', () => {
    assert.ok(app.service('refes-establishments'));
  });

  it('gets an establishment by REFES code', async () => {
    const result = await app.service('refes-establishments').get('10000012345678');
    assert.strictEqual(result.name, 'HOSPITAL GENERAL SAN MARTÍN');
    assert.strictEqual(result.province, 'BUENOS AIRES');
  });

  it('finds establishments with accent-insensitive $search', async () => {
    const result = await app.service('refes-establishments').find({
      query: { $search: 'gonzalez' },
    }) as { total: number; data: { id: string }[] };
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].id, '52500282358948');
  });

  it('requires every search word to match', async () => {
    const none = await app.service('refes-establishments').find({
      query: { $search: 'hospital mendoza' },
    }) as { total: number };
    assert.strictEqual(none.total, 0);

    const one = await app.service('refes-establishments').find({
      query: { $search: 'hospital martin' },
    }) as { total: number };
    assert.strictEqual(one.total, 1);
  });

  it('matches by city and province too', async () => {
    const result = await app.service('refes-establishments').find({
      query: { $search: 'guaymallen consultorio' },
    }) as { total: number; data: { id: string }[] };
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].id, '52500282358948');
  });

  it('excludes deactivated establishments from find/search by default', async () => {
    await app.service('refes-establishments').create({
      id: '99999999999999',
      name: 'HOSPITAL CERRADO GONZALEZ',
      isActive: false,
    });

    const search = await app.service('refes-establishments').find({
      query: { $search: 'cerrado' },
    }) as { total: number };
    assert.strictEqual(search.total, 0);

    // Explicit isActive query overrides the default filter
    const explicit = await app.service('refes-establishments').find({
      query: { $search: 'cerrado', isActive: false },
    }) as { total: number };
    assert.strictEqual(explicit.total, 1);

    // Get by id still resolves (saved orgs keep their labels)
    const got = await app.service('refes-establishments').get('99999999999999');
    assert.strictEqual(got.name, 'HOSPITAL CERRADO GONZALEZ');

    await app.service('refes-establishments').remove('99999999999999');
  });

  it('rejects external writes', async () => {
    const org = await createTestOrganization();
    const user = await createTestUser({
      username: `test.refes.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    await assert.rejects(
      app.service('refes-establishments').create(
        { id: 'x', name: 'Nope' },
        { provider: 'rest', user, authenticated: true }
      ),
      /not allowed|MethodNotAllowed/i
    );
  });
});
