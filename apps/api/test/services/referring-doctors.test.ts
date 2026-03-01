import assert from 'assert';
import app from '../../src/app';
import { createTestOrganization } from '../test-helpers';

describe('\'referring-doctors\' service', () => {
  let medic: any;
  let patient: any;
  let org: any;

  before(async () => {
    org = await createTestOrganization({
      name: 'Referring Docs Clinic',
      slug: `ref-docs-test-${Date.now()}`,
    });

    medic = await app.service('users').create({
      username: 'refdoc.medic',
      password: 'SuperSecret1',
      personalData: {
        firstName: 'Carlos',
        lastName: 'Gomez',
        documentValue: 'REFDOC001'
      }
    } as any);

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: medic.id,
    } as any);

    await app.service('user-roles').create({
      userId: medic.id,
      roleId: 'medic',
      organizationId: org.id,
    } as any);

    patient = await app.service('patients').create({
      medicare: 'REFDOC_OSDE',
      medicareNumber: '55667788'
    });

    await app.service('studies').create({
      date: new Date(),
      studies: ['hemogram'],
      noOrder: false,
      patientId: patient.id,
      referringDoctor: 'Dr. External Referrer'
    });
  });

  it('registered the service', () => {
    const service = app.service('referring-doctors');
    assert.ok(service, 'Registered the service');
  });

  it('returns referring doctors from studies', async () => {
    const results = await app.service('referring-doctors').find();

    assert.ok(Array.isArray(results), 'Returns an array');
    const external = results.find((r: any) => r.name === 'Dr. External Referrer');
    assert.ok(external, 'Found the external referring doctor');
    assert.strictEqual(external.medicId, null, 'External doctor has null medicId');
  });

  it('includes medics as referring doctors', async () => {
    const results = await app.service('referring-doctors').find();

    const medicRef = results.find((r: any) => r.medicId === medic.id);
    assert.ok(medicRef, 'Found the medic as a referring doctor');
    assert.ok(medicRef.name.includes('Gomez'), 'Medic name is populated');
  });

  it('filters by organizationId', async () => {
    const results = await app.service('referring-doctors').find({
      organizationId: org.id
    } as any);

    assert.ok(Array.isArray(results), 'Returns an array');
    const medicRef = results.find((r: any) => r.medicId === medic.id);
    assert.ok(medicRef, 'Found the medic in the org');
  });

  it('results are sorted by name', async () => {
    const results = await app.service('referring-doctors').find();

    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i].name >= results[i - 1].name,
        `Results are sorted: "${results[i - 1].name}" <= "${results[i].name}"`
      );
    }
  });
});
