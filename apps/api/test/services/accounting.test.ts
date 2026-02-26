import assert from 'assert';
import dayjs from 'dayjs';
import app from '../../src/app';

describe('\'accounting\' service', () => {
  let medic: any;
  let patient: any;
  let prepaga: any;

  before(async () => {
    await app.service('roles').create({
      id: 'medic',
      permissions: ['*'],
    }).catch(() => null);

    medic = await app.service('users').create({
      username: 'test.medic.accounting',
      password: 'SuperSecret1',
      roleId: 'medic',
    });

    patient = await app.service('patients').create({
      medicare: 'OSDE BINARIO',
      medicareNumber: '999888',
    });

    prepaga = await app.service('prepagas').create({
      shortName: 'OSDE',
      denomination: 'OSDE Binario',
    });

    await app.service('personal-data').create({
      firstName: 'John',
      lastName: 'Doe',
      documentValue: 'ACC-TEST-DOC-001',
    }).then(async (pd: any) => {
      await app.service('patient-personal-data').create({
        ownerId: patient.id,
        personalDataId: pd.id,
      });
    });

    await app.service('md-settings').create({
      userId: medic.id,
      encounterDuration: 30,
      insurerPrices: {
        [prepaga.id]: {
          encounter: 5000,
          anemia: 3000,
          hemostasis: 2000,
          anticoagulation: 1500,
        },
      },
    } as any);
  });

  it('registered the service', () => {
    const service = app.service('accounting');
    assert.ok(service, 'Registered the service');
  });

  it('requires from and to query params', async () => {
    try {
      await app.service('accounting').find({ query: {} });
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
    }
  });

  it('returns encounters in the date range', async () => {
    const today = dayjs();

    await app.service('encounters').create({
      data: { simple: { values: { note: 'acc test' } } },
      date: today.toDate(),
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const result = await app.service('accounting').find({
      query: {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.add(1, 'day').format('YYYY-MM-DD'),
      },
      user: medic,
    } as any);

    const encounterRecords = result.records.filter(
      (r: any) => r.kind === 'encounter' && r.patientName === 'John Doe'
    );

    assert.ok(encounterRecords.length >= 1, 'Should have at least one encounter record');
    assert.strictEqual(encounterRecords[0].kind, 'encounter');
    assert.strictEqual(encounterRecords[0].cost, 5000);
    assert.strictEqual(encounterRecords[0].patientName, 'John Doe');
  });

  it('explodes multi-type studies into separate rows', async () => {
    const today = dayjs();

    await app.service('studies').create({
      date: today.toDate(),
      studies: ['anemia', 'hemostasis'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const result = await app.service('accounting').find({
      query: {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.add(1, 'day').format('YYYY-MM-DD'),
      },
      user: medic,
    } as any);

    const studyRows = result.records.filter((r: any) => r.patientName === 'John Doe');

    const anemiaRows = studyRows.filter((r: any) => r.kind === 'anemia');
    const hemostasisRows = studyRows.filter((r: any) => r.kind === 'hemostasis');

    assert.ok(anemiaRows.length >= 1, 'Should have at least one anemia row');
    assert.ok(hemostasisRows.length >= 1, 'Should have at least one hemostasis row');
  });

  it('resolves per-type study costs from insurerPrices', async () => {
    const today = dayjs();

    await app.service('studies').create({
      date: today.toDate(),
      studies: ['anemia', 'anticoagulation'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const result = await app.service('accounting').find({
      query: {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.add(1, 'day').format('YYYY-MM-DD'),
      },
      user: medic,
    } as any);

    const studyRows = result.records.filter((r: any) => r.patientName === 'John Doe');

    const anemia = studyRows.find((r: any) => r.kind === 'anemia');
    const anticoag = studyRows.find((r: any) => r.kind === 'anticoagulation');

    assert.ok(anemia, 'Anemia row exists');
    assert.strictEqual(anemia.cost, 3000, 'Anemia cost resolved from insurerPrices');
    assert.ok(anticoag, 'Anticoagulation row exists');
    assert.strictEqual(anticoag.cost, 1500, 'Anticoagulation cost resolved from insurerPrices');
  });

  it('filters by insurerId', async () => {
    const today = dayjs();

    const otherPrepaga = await app.service('prepagas').create({
      shortName: 'OTHER',
      denomination: 'Other Prepaga',
    });

    await app.service('encounters').create({
      data: { simple: { values: { note: 'other insurer' } } },
      date: today.toDate(),
      medicId: medic.id,
      patientId: patient.id,
      insurerId: otherPrepaga.id,
    } as any);

    const result = await app.service('accounting').find({
      query: {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.add(1, 'day').format('YYYY-MM-DD'),
        insurerId: otherPrepaga.id,
      },
      user: medic,
    } as any);

    const allInsurerIds = new Set(result.records.map((r: any) => r.insurerId));
    assert.ok(
      !allInsurerIds.has(prepaga.id),
      'Should not contain records from the other insurer when filtering'
    );
  });

  it('filters by date range correctly', async () => {
    const oldDate = dayjs().subtract(2, 'year');

    await app.service('encounters').create({
      data: { simple: { values: { note: 'old' } } },
      date: oldDate.toDate(),
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const result = await app.service('accounting').find({
      query: {
        from: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        to: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      },
      user: medic,
    } as any);

    const oldRecords = result.records.filter((r: any) => dayjs(r.date).isBefore(dayjs().subtract(1, 'year')));
    assert.strictEqual(oldRecords.length, 0, 'Old records should not appear in recent range');
  });

  it('computes aggregations correctly', async () => {
    const today = dayjs();

    const result = await app.service('accounting').find({
      query: {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.add(1, 'day').format('YYYY-MM-DD'),
      },
      user: medic,
    } as any);

    assert.ok(typeof result.totalRevenue === 'number', 'totalRevenue is a number');
    assert.ok(Array.isArray(result.revenueByDay), 'revenueByDay is an array');
    assert.ok(Array.isArray(result.revenueByInsurer), 'revenueByInsurer is an array');

    const sumFromRecords = result.records.reduce((acc: number, r: any) => acc + r.cost, 0);
    assert.strictEqual(
      result.totalRevenue,
      Number(sumFromRecords.toFixed(2)),
      'totalRevenue matches sum of record costs'
    );

    const sumFromByDay = result.revenueByDay.reduce((acc: number, d: any) => acc + d.revenue, 0);
    assert.strictEqual(
      Number(sumFromByDay.toFixed(2)),
      result.totalRevenue,
      'revenueByDay sums to totalRevenue'
    );
  });

  it('includes protocol number for study rows', async () => {
    const today = dayjs();

    const study = await app.service('studies').create({
      date: today.toDate(),
      studies: ['thrombophilia'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const result = await app.service('accounting').find({
      query: {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.add(1, 'day').format('YYYY-MM-DD'),
      },
      user: medic,
    } as any);

    const thrombRow = result.records.find(
      (r: any) => r.kind === 'thrombophilia' && r.id === study.id
    );
    assert.ok(thrombRow, 'Thrombophilia row exists');
    assert.strictEqual(thrombRow.protocol, study.protocol, 'Protocol number matches');
    assert.strictEqual(thrombRow.kind, 'thrombophilia');
  });
});
