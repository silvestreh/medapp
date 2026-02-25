import assert from 'assert';
import dayjs from 'dayjs';
import app from '../../src/app';
import client from '../test-client';

describe("'stats' service", () => {
  let labOwner: any;
  let medic: any;
  let patient1: any;
  let patient2: any;
  let org: any;
  let server: any;

  before(async () => {
    server = await app.listen(app.get('port'));

    await app
      .service('roles')
      .create({
        id: 'lab-owner',
        permissions: [
          'studies:create:all',
          'studies:find:all',
          'studies:get:all',
          'studies:patch:all',
          'studies:remove:all',
          'stats:find:all',
        ],
      })
      .catch(() => null);

    await app
      .service('roles')
      .create({
        id: 'medic',
        permissions: [
          'studies:create',
          'studies:find',
          'studies:get',
          'studies:patch',
        ],
      })
      .catch(() => null);

    org = await app.service('organizations').create({
      name: 'Stats Test Lab',
      slug: 'stats-test-lab',
    });

    labOwner = await app.service('users').create({
      username: 'stats.labowner',
      password: 'Password123',
      roleId: 'lab-owner',
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: labOwner.id,
      role: 'member',
    });

    medic = await app.service('users').create({
      username: 'stats.medic',
      password: 'Password123',
      roleId: 'medic',
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: medic.id,
      role: 'member',
    });

    patient1 = await app.service('patients').create({
      medicare: 'stats-med-1',
      medicareNumber: 'S001',
      medicarePlan: 'planA',
    });

    patient2 = await app.service('patients').create({
      medicare: 'stats-med-2',
      medicareNumber: 'S002',
      medicarePlan: 'planA',
    });

    const pd1 = await app.service('personal-data').create({
      firstName: 'Young',
      lastName: 'Patient',
      documentType: 'DNI',
      documentValue: 'stats-pd-001',
      birthDate: '1998-06-15',
    });

    await app.service('patient-personal-data').create({
      ownerId: patient1.id,
      personalDataId: pd1.id,
    });

    const pd2 = await app.service('personal-data').create({
      firstName: 'Senior',
      lastName: 'Patient',
      documentType: 'DNI',
      documentValue: 'stats-pd-002',
      birthDate: '1955-01-10',
    });

    await app.service('patient-personal-data').create({
      ownerId: patient2.id,
      personalDataId: pd2.id,
    });

    await app.service('studies').create({
      date: new Date(),
      studies: ['anemia', 'hemostasis'],
      noOrder: false,
      medicId: null,
      patientId: patient1.id,
      organizationId: org.id,
    } as any);

    await app.service('studies').create({
      date: new Date(),
      studies: ['anemia'],
      noOrder: false,
      medicId: null,
      patientId: patient2.id,
      organizationId: org.id,
    } as any);

    await app.service('studies').create({
      date: dayjs().subtract(2, 'year').toDate(),
      studies: ['thrombophilia'],
      noOrder: false,
      medicId: null,
      patientId: patient1.id,
      organizationId: org.id,
    } as any);
  });

  after(async () => {
    await server.close();
  });

  it('registered the service', () => {
    const service = app.service('stats');
    assert.ok(service, 'Registered the service');
  });

  it('returns study type counts for the given date range', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(result.studyTypeCounts, 'Has studyTypeCounts');
    assert.ok(Array.isArray(result.studyTypeCounts), 'studyTypeCounts is an array');

    const anemiaRow = result.studyTypeCounts.find(
      (r: any) => r.studyType === 'anemia'
    );
    assert.ok(anemiaRow, 'Anemia type exists');
    assert.strictEqual(anemiaRow.count, 2, 'Two anemia entries from two studies');

    const hemostasisRow = result.studyTypeCounts.find(
      (r: any) => r.studyType === 'hemostasis'
    );
    assert.ok(hemostasisRow, 'Hemostasis type exists');
    assert.strictEqual(hemostasisRow.count, 1, 'One hemostasis entry');
  });

  it('excludes studies outside the date range', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    const thrombo = result.studyTypeCounts.find(
      (r: any) => r.studyType === 'thrombophilia'
    );
    assert.strictEqual(thrombo, undefined, 'Old thrombophilia study excluded');
  });

  it('returns age group data', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(result.ageGroups, 'Has ageGroups');
    assert.ok(Array.isArray(result.ageGroups), 'ageGroups is an array');
    assert.ok(result.ageGroups.length > 0, 'Has age group entries');

    for (const entry of result.ageGroups) {
      assert.ok(entry.studyType, 'Entry has studyType');
      assert.ok(entry.bucket, 'Entry has bucket');
      assert.ok(typeof entry.count === 'number', 'Entry has numeric count');
    }
  });

  it('correctly buckets ages', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    const youngAnemia = result.ageGroups.find(
      (e: any) => e.studyType === 'anemia' && e.bucket === '18-34'
    );
    assert.ok(youngAnemia, 'Young patient (born 1998) in 18-34 bucket for anemia');

    const seniorAnemia = result.ageGroups.find(
      (e: any) => e.studyType === 'anemia' && e.bucket === '65+'
    );
    assert.ok(seniorAnemia, 'Senior patient (born 1955) in 65+ bucket for anemia');
  });

  it('requires from and to query params', async () => {
    try {
      await app.service('stats').find({
        query: {},
      });
      assert.fail('Should throw BadRequest');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
    }
  });

  it('rejects to before from', async () => {
    try {
      await app.service('stats').find({
        query: {
          from: dayjs().toISOString(),
          to: dayjs().subtract(7, 'day').toISOString(),
        },
      });
      assert.fail('Should throw BadRequest');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
    }
  });

  it('allows lab-owner to access stats via external call', async () => {
    await client.authenticate({
      strategy: 'local',
      username: 'stats.labowner',
      password: 'Password123',
    });

    const result: any = await client.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
    });

    assert.ok(result.studyTypeCounts, 'Lab owner can access stats');
    await client.logout();
  });

  it('forbids non-lab-owner from accessing stats', async () => {
    await client.authenticate({
      strategy: 'local',
      username: 'stats.medic',
      password: 'Password123',
    });

    try {
      await client.service('stats').find({
        query: {
          from: dayjs().subtract(7, 'day').toISOString(),
          to: dayjs().add(1, 'day').toISOString(),
        },
      });
      assert.fail('Should throw Forbidden');
    } catch (error: any) {
      assert.strictEqual(error.name, 'Forbidden');
    }

    await client.logout();
  });

  it('accepts wide date ranges and returns correct shape', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(5, 'year').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(result.studyTypeCounts, 'Has studyTypeCounts');
    assert.ok(result.ageGroups, 'Has ageGroups');

    const thrombo = result.studyTypeCounts.find(
      (r: any) => r.studyType === 'thrombophilia'
    );
    assert.ok(thrombo, 'Wide range includes old thrombophilia study');
    assert.strictEqual(thrombo.count, 1);
  });

  it('returns empty arrays when no studies match', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: '2000-01-01T00:00:00.000Z',
        to: '2000-12-31T23:59:59.999Z',
      },
      organizationId: org.id,
    });

    assert.deepStrictEqual(result.studyTypeCounts, []);
    assert.deepStrictEqual(result.ageGroups, []);
  });
});
