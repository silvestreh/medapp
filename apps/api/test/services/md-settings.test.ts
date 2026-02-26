import assert from 'assert';
import app from '../../src/app';

describe('\'md-settings\' service', () => {
  let user: any;

  before(async () => {
    user = await app.service('users').create({
      username: 'test.medic.md.settings.accounting',
      password: 'SuperSecret1',
      roleId: 'medic'
    });
  });

  it('registered the service', () => {
    const service = app.service('md-settings');

    assert.ok(service, 'Registered the service');
  });

  it('stores insurer-specific prices', async () => {
    const service = app.service('md-settings');
    const insurerPrices = {
      prepaga_a: { encounter: 100, anemia: 50 },
      prepaga_b: { encounter: 200, hemostasis: 75 }
    };

    const created = await service.create({
      userId: user.id,
      encounterDuration: 30,
      insurerPrices
    } as any);

    assert.deepStrictEqual(created.insurerPrices, insurerPrices);
  });

  it('patches insurer-specific prices', async () => {
    const service = app.service('md-settings');
    const created = await service.create({
      userId: user.id,
      encounterDuration: 20,
      insurerPrices: {}
    } as any);

    const insurerPrices = {
      prepaga_c: { encounter: 320, thrombophilia: 140 }
    };
    const patched = await service.patch(created.id, { insurerPrices } as any);

    assert.deepStrictEqual(patched.insurerPrices, insurerPrices);
  });
});
