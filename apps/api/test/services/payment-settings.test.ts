import assert from 'assert';
import type { Id } from '@feathersjs/feathers';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

// Deliberately-invalid payloads can't compile against the strict
// PaymentSettings types, so validation tests go through this untyped view.
interface UntypedService {
  create(data: Record<string, unknown>, params?: unknown): Promise<unknown>;
  patch(id: Id, data: Record<string, unknown>, params?: unknown): Promise<unknown>;
}

const untypedPaymentSettings = (): UntypedService =>
  app.service('payment-settings') as unknown as UntypedService;

describe('\'payment-settings\' service', function () {
  this.timeout(20000);

  let orgA: any;
  let orgB: any;
  let medicA1: any;
  let medicA2: any;
  let medicB1: any;
  let settingsA1: any;

  const asProvider = (user: any, organizationId?: Id, extra: Record<string, any> = {}) => ({
    provider: 'rest',
    authenticated: true,
    user,
    ...(organizationId ? { organizationId } : {}),
    ...extra,
  } as any);

  before(async () => {
    const stamp = Date.now();
    orgA = await createTestOrganization({ slug: `pay-settings-a-${stamp}` });
    orgB = await createTestOrganization({ slug: `pay-settings-b-${stamp}` });

    medicA1 = await createTestUser({
      username: `pay.settings.a1.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgA.id,
    });
    medicA2 = await createTestUser({
      username: `pay.settings.a2.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgA.id,
    });
    medicB1 = await createTestUser({
      username: `pay.settings.b1.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgB.id,
    });
  });

  it('registered the service', () => {
    assert.ok(app.service('payment-settings'));
  });

  it('creates settings scoped to the requesting medic and organization', async () => {
    settingsA1 = await app.service('payment-settings').create({
      enabled: true,
      chargePortion: 50,
      requirementMode: 'required',
      holdWindowMinutes: 30,
    }, asProvider(medicA1, orgA.id)) as any;

    assert.strictEqual(settingsA1.userId, medicA1.id);
    assert.strictEqual(settingsA1.organizationId, orgA.id);
    assert.strictEqual(settingsA1.enabled, true);
    assert.strictEqual(settingsA1.chargePortion, 50);
    assert.strictEqual(settingsA1.requirementMode, 'required');
    assert.strictEqual(settingsA1.holdWindowMinutes, 30);
  });

  it('applies safe defaults', async () => {
    const created = await app.service('payment-settings').create({}, asProvider(medicA2, orgA.id)) as any;

    assert.strictEqual(created.enabled, false);
    assert.strictEqual(created.chargePortion, 100);
    assert.strictEqual(created.requirementMode, 'optional');
    assert.strictEqual(created.holdWindowMinutes, 20);
  });

  it('rejects invalid values', async () => {
    const service = untypedPaymentSettings();

    await assert.rejects(
      service.patch(settingsA1.id, { chargePortion: 33 }, asProvider(medicA1, orgA.id)),
      /chargePortion/
    );
    await assert.rejects(
      service.patch(settingsA1.id, { requirementMode: 'always' }, asProvider(medicA1, orgA.id)),
      /requirementMode/
    );
    await assert.rejects(
      service.patch(settingsA1.id, { holdWindowMinutes: 3 }, asProvider(medicA1, orgA.id)),
      /holdWindowMinutes/
    );
    await assert.rejects(
      service.patch(settingsA1.id, { holdWindowMinutes: 20.5 }, asProvider(medicA1, orgA.id)),
      /holdWindowMinutes/
    );
    await assert.rejects(
      service.patch(settingsA1.id, { enabled: 'yes' }, asProvider(medicA1, orgA.id)),
      /enabled/
    );
  });

  it('rejects unknown fields (the fee cannot be set here)', async () => {
    const service = untypedPaymentSettings();

    await assert.rejects(
      service.patch(settingsA1.id, { feeAmount: 999999 }, asProvider(medicA1, orgA.id)),
      /Unknown field/
    );
    await assert.rejects(
      service.patch(settingsA1.id, { amount: 1 }, asProvider(medicA1, orgA.id)),
      /Unknown field/
    );
  });

  it('requires an organization context', async () => {
    await assert.rejects(
      app.service('payment-settings').find({ query: {}, ...asProvider(medicA1) }),
      /organization context is required/
    );
  });

  it('scopes find to the requesting medic', async () => {
    const result = await app.service('payment-settings').find({
      query: {},
      ...asProvider(medicA2, orgA.id),
    }) as any;
    const rows = result.data || result;

    assert.ok(rows.every((row: any) => row.userId === medicA2.id));
    assert.ok(rows.every((row: any) => String(row.id) !== String(settingsA1.id)));
  });

  it('denies another medic in the same organization access to the record', async () => {
    await assert.rejects(
      app.service('payment-settings').get(settingsA1.id, asProvider(medicA2, orgA.id)),
      /own records/
    );
    await assert.rejects(
      app.service('payment-settings').patch(settingsA1.id, { enabled: false }, asProvider(medicA2, orgA.id)),
      /own records/
    );
  });

  it('denies cross-organization access', async () => {
    await assert.rejects(
      app.service('payment-settings').get(settingsA1.id, asProvider(medicB1, orgB.id)),
      /different organization|own records/
    );

    const result = await app.service('payment-settings').find({
      query: {},
      ...asProvider(medicB1, orgB.id),
    }) as any;
    const rows = result.data || result;
    assert.ok(rows.every((row: any) => String(row.id) !== String(settingsA1.id)));
  });

  it('blocks external update and remove', async () => {
    await assert.rejects(
      app.service('payment-settings').update(settingsA1.id, { ...settingsA1, enabled: false }, asProvider(medicA1, orgA.id))
    );
    await assert.rejects(
      app.service('payment-settings').remove(settingsA1.id, asProvider(medicA1, orgA.id))
    );
  });

  it('blocks an inactive organization', async () => {
    const stamp = Date.now();
    const inactiveOrg = await createTestOrganization({ slug: `pay-settings-inactive-${stamp}`, isActive: false });
    const medicInactive = await createTestUser({
      username: `pay.settings.inactive.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: inactiveOrg.id,
    });

    await assert.rejects(
      app.service('payment-settings').create({ enabled: true }, asProvider(medicInactive, inactiveOrg.id)),
      /read-only/
    );
  });

  it('enforces one settings row per (userId, organizationId) at the DB level', async () => {
    await assert.rejects(
      app.service('payment-settings').create({}, asProvider(medicA1, orgA.id))
    );
  });
});
