import assert from 'assert';
import app from '../../src/app';
import type { AccountingSettings } from '../../src/declarations';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { pesosToMinorUnits, resolveAmount } from '../../src/services/payments/amount-resolver';

type InsurerPrices = AccountingSettings['insurerPrices'];

describe('payments amount resolver', function () {
  this.timeout(20000);

  let org: any;
  let medic: any;

  const setPrices = async (insurerPrices: InsurerPrices) => {
    const existing = await app.service('accounting-settings').find({
      query: { userId: medic.id, organizationId: org.id, $limit: 1 },
      provider: undefined,
    }) as any;
    const row = (existing.data || existing)[0];

    if (row) {
      return app.service('accounting-settings').patch(row.id, { insurerPrices }, { provider: undefined });
    }

    return app.service('accounting-settings').create({
      userId: medic.id,
      organizationId: org.id,
      insurerPrices,
    }, { provider: undefined });
  };

  const resolve = (chargePortion: number) => resolveAmount('private_fee', {
    app,
    medicId: medic.id,
    organizationId: org.id,
    chargePortion,
  });

  before(async () => {
    const suffix = Date.now().toString(36);
    org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.amounts.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  it('converts pesos to integer minor units', () => {
    assert.strictEqual(pesosToMinorUnits(5000), 500000);
    assert.strictEqual(pesosToMinorUnits(1234.56), 123456);
    assert.strictEqual(pesosToMinorUnits(0.01), 1);
    assert.strictEqual(pesosToMinorUnits(33.33), 3333);
  });

  it('returns null when the professional has no accounting settings', async () => {
    assert.strictEqual(await resolve(100), null);
  });

  it('returns null when there is no _particular encounter price', async () => {
    await setPrices({ 'some-insurer': { encounter: 5000 } });
    assert.strictEqual(await resolve(100), null);
  });

  it('returns null when the configured price is zero', async () => {
    await setPrices({ _particular: { encounter: 0 } });
    assert.strictEqual(await resolve(100), null);
  });

  it('resolves a plain numeric price with every charge portion', async () => {
    await setPrices({ _particular: { encounter: 5000 } });

    const full = await resolve(100);
    assert.deepStrictEqual(full, {
      resolverId: 'private_fee',
      amount: 500000,
      currency: 'ARS',
      feePesos: 5000,
      feeMinor: 500000,
      chargePortion: 100,
    });

    const half = await resolve(50);
    assert.strictEqual(half?.amount, 250000);
    assert.strictEqual(half?.feeMinor, 500000);

    const quarter = await resolve(25);
    assert.strictEqual(quarter?.amount, 125000);
  });

  it('resolves a fixed PricingConfig price', async () => {
    await setPrices({ _particular: { encounter: { type: 'fixed', value: 1234.56 } } });

    const resolved = await resolve(25);
    assert.strictEqual(resolved?.feeMinor, 123456);
    assert.strictEqual(resolved?.amount, 30864);
  });

  it('resolves a multiplier PricingConfig price', async () => {
    await setPrices({ _particular: { encounter: { type: 'multiplier', baseValue: 1000, multiplier: 2.5 } } });

    const resolved = await resolve(100);
    assert.strictEqual(resolved?.feePesos, 2500);
    assert.strictEqual(resolved?.amount, 250000);
  });

  it('rounds odd-centavo deposits to integer minor units', async () => {
    await setPrices({ _particular: { encounter: 33.33 } });

    const resolved = await resolve(25);
    // 3333 * 25 / 100 = 833.25 → 833. Never a float.
    assert.strictEqual(resolved?.amount, 833);
    assert.ok(Number.isInteger(resolved?.amount));
  });

  it('throws on an unknown resolver id', async () => {
    await assert.rejects(
      resolveAmount('coseguro', { app, medicId: medic.id, organizationId: org.id, chargePortion: 100 }),
      /Unknown amount resolver/
    );
  });
});
