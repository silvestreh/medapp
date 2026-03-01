import assert from 'assert';
import app from '../../src/app';

describe('\'accounting-settings\' service', () => {
  let medic: any;

  before(async () => {
    await app.get('sequelizeSync');

    await app.service('roles').create({
      id: 'medic',
      permissions: ['*'],
    }).catch(() => null);

    const existingUsers = await app.service('users').find({
      query: { username: 'test.medic.acct-settings', $limit: 1 },
      paginate: false,
    }) as any[];

    if (existingUsers.length) {
      medic = existingUsers[0];
    } else {
      medic = await app.service('users').create({
        username: 'test.medic.acct-settings',
        password: 'SuperSecret1',
      } as any);
    }
  });

  it('registered the service', () => {
    const service = app.service('accounting-settings');
    assert.ok(service, 'Registered the service');
  });

  it('creates accounting settings for a user', async () => {
    const settings = await app.service('accounting-settings').create({
      userId: medic.id,
      insurerPrices: {
        _particular: { encounter: 1000 },
      },
    } as any);

    assert.ok(settings.id, 'Has an id');
    assert.strictEqual(settings.userId, medic.id);
    assert.deepStrictEqual((settings as any).insurerPrices, {
      _particular: { encounter: 1000 },
    });
  });

  it('finds accounting settings by userId', async () => {
    const results = await app.service('accounting-settings').find({
      query: { userId: medic.id },
      paginate: false,
    }) as any[];

    assert.ok(results.length >= 1, 'Found at least one record');
    assert.strictEqual(results[0].userId, medic.id);
  });

  it('patches insurerPrices', async () => {
    const results = await app.service('accounting-settings').find({
      query: { userId: medic.id, $limit: 1 },
      paginate: false,
    }) as any[];

    const updated = await app.service('accounting-settings').patch(results[0].id, {
      insurerPrices: {
        _particular: { encounter: 2000 },
        some_insurer: { anemia: 500 },
      },
    } as any);

    assert.deepStrictEqual((updated as any).insurerPrices, {
      _particular: { encounter: 2000 },
      some_insurer: { anemia: 500 },
    });
  });

  it('defaults insurerPrices to empty object', async () => {
    const other = await app.service('users').create({
      username: `test.medic.acct-default-${Date.now()}`,
      password: 'SuperSecret1',
    } as any);

    const settings = await app.service('accounting-settings').create({
      userId: other.id,
    } as any);

    assert.deepStrictEqual((settings as any).insurerPrices, {});
  });
});
