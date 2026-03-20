import assert from 'assert';
import dayjs from 'dayjs';
import app from '../../src/app';
import { createTestClient } from '../test-client';

describe('\'stats\' service', () => {
  let labOwner: any;
  let medic: any;
  let patient1: any;
  let patient2: any;
  let org: any;
  let server: any;
  let studyWithResults: any;
  let client: any;
  const uniqueSuffix = Date.now().toString();

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
      slug: `stats-test-lab-${uniqueSuffix}`,
      isActive: true,
    });

    client = createTestClient(org.id as string);

    labOwner = await app.service('users').create({
      username: `stats.labowner.${uniqueSuffix}`,
      password: 'Password123!',
    } as any);

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: labOwner.id,
    } as any);

    await app.service('user-roles').create({
      userId: labOwner.id,
      roleId: 'lab-owner',
      organizationId: org.id,
    } as any);

    medic = await app.service('users').create({
      username: `stats.medic.${uniqueSuffix}`,
      password: 'Password123!',
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

    patient1 = await app.service('patients').create({
      medicare: `stats-med-1-${uniqueSuffix}`,
      medicareNumber: 'S001',
      medicarePlan: 'planA',
    });

    patient2 = await app.service('patients').create({
      medicare: `stats-med-2-${uniqueSuffix}`,
      medicareNumber: 'S002',
      medicarePlan: 'planA',
    });

    const pd1 = await app.service('personal-data').create({
      firstName: 'Young',
      lastName: 'Patient',
      documentType: 'DNI',
      documentValue: `stats-pd-001-${uniqueSuffix}`,
      birthDate: new Date('1998-06-15'),
      gender: 'male',
      nationality: 'AR',
    } as any);

    await app.service('patient-personal-data').create({
      ownerId: patient1.id,
      personalDataId: pd1.id,
    });

    const pd2 = await app.service('personal-data').create({
      firstName: 'Senior',
      lastName: 'Patient',
      documentType: 'DNI',
      documentValue: `stats-pd-002-${uniqueSuffix}`,
      birthDate: new Date('1955-01-10'),
      gender: 'female',
      nationality: 'UY',
    } as any);

    await app.service('patient-personal-data').create({
      ownerId: patient2.id,
      personalDataId: pd2.id,
    });

    studyWithResults = await app.service('studies').create({
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
      noOrder: true,
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

    await app.service('study-results').create({
      data: { value: 'complete' },
      studyId: studyWithResults.id,
      type: 'anemia',
    });
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

  it('returns gender groups by study type', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(Array.isArray(result.genderGroups), 'Has genderGroups array');
    const maleAnemia = result.genderGroups.find(
      (e: any) => e.studyType === 'anemia' && e.gender === 'male'
    );
    const femaleAnemia = result.genderGroups.find(
      (e: any) => e.studyType === 'anemia' && e.gender === 'female'
    );
    assert.ok(maleAnemia, 'Male anemia entry exists');
    assert.ok(femaleAnemia, 'Female anemia entry exists');
  });

  it('returns studies-over-time trend', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(Array.isArray(result.studiesOverTime), 'Has studiesOverTime array');
    assert.ok(result.studiesOverTime.length > 0, 'Has at least one trend point');
    assert.ok(result.studiesOverTime[0].period, 'Trend point has period');
    assert.ok(typeof result.studiesOverTime[0].count === 'number', 'Trend point has count');
  });

  it('returns no-order rate', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(result.noOrderRate, 'Has noOrderRate');
    assert.strictEqual(result.noOrderRate.total, 2, 'Two studies in selected range');
    assert.strictEqual(result.noOrderRate.noOrder, 1, 'One no-order study in selected range');
    assert.strictEqual(result.noOrderRate.rate, 0.5, 'No-order rate is 50%');
  });

  it('returns average studies per patient', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.strictEqual(result.avgStudiesPerPatient, 1, 'Average studies per patient is 1');
  });

  it('returns result completion rate', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(result.completionRate, 'Has completionRate');
    assert.strictEqual(result.completionRate.total, 2, 'Two studies in selected range');
    assert.strictEqual(result.completionRate.withResults, 1, 'One study has results');
    assert.strictEqual(result.completionRate.rate, 0.5, 'Completion rate is 50%');
  });

  it('returns nationality distribution', async () => {
    const result: any = await app.service('stats').find({
      query: {
        from: dayjs().subtract(7, 'day').toISOString(),
        to: dayjs().add(1, 'day').toISOString(),
      },
      organizationId: org.id,
    });

    assert.ok(Array.isArray(result.nationalityDistribution), 'Has nationality distribution array');
    const arEntry = result.nationalityDistribution.find((e: any) => e.nationality === 'AR');
    const uyEntry = result.nationalityDistribution.find((e: any) => e.nationality === 'UY');
    assert.ok(arEntry, 'AR nationality entry exists');
    assert.ok(uyEntry, 'UY nationality entry exists');
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
      username: `stats.labowner.${uniqueSuffix}`,
      password: 'Password123!',
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
      username: `stats.medic.${uniqueSuffix}`,
      password: 'Password123!',
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
    assert.ok(result.genderGroups, 'Has genderGroups');
    assert.ok(result.studiesOverTime, 'Has studiesOverTime');
    assert.ok(result.noOrderRate, 'Has noOrderRate');
    assert.ok(typeof result.avgStudiesPerPatient === 'number', 'Has avgStudiesPerPatient');
    assert.ok(result.completionRate, 'Has completionRate');
    assert.ok(result.nationalityDistribution, 'Has nationalityDistribution');

    const thrombo = result.studyTypeCounts.find(
      (r: any) => r.studyType === 'thrombophilia'
    );
    assert.ok(thrombo, 'Wide range includes old thrombophilia study');
    assert.strictEqual(thrombo.count, 1);

    const monthlyBucketed = result.studiesOverTime.every((entry: any) => {
      const monthStart = dayjs(entry.period).date() === 1;
      return monthStart;
    });
    assert.ok(monthlyBucketed, 'Wide range trend is quantized to monthly buckets');
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
    assert.deepStrictEqual(result.genderGroups, []);
    assert.deepStrictEqual(result.studiesOverTime, []);
    assert.deepStrictEqual(result.nationalityDistribution, []);
    assert.deepStrictEqual(result.noOrderRate, { total: 0, noOrder: 0, rate: 0 });
    assert.strictEqual(result.avgStudiesPerPatient, 0);
    assert.deepStrictEqual(result.completionRate, { total: 0, withResults: 0, rate: 0 });
  });
});
