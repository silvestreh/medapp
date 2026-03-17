import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'sire-push-tokens\' service', () => {
  let org: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization({ slug: `sire-push-${Date.now()}` });
    await createTestUser({
      username: `push.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Push',
        lastName: 'Patient',
        documentValue: `sire-push-${Date.now()}`,
      },
      contactData: {
        phoneNumber: ['cel:1155550001'],
      },
    } as any);
  });

  it('registered the service', () => {
    const service = app.service('sire-push-tokens');
    assert.ok(service, 'Registered the service');
  });

  it('registers a push token', async () => {
    const result: any = await app.service('sire-push-tokens').create({
      action: 'register',
      token: `ExponentPushToken[test-${Date.now()}]`,
      platform: 'ios',
    }, {
      patient: { id: patient.id, organizationId: org.id },
    } as any);

    assert.strictEqual(result.status, 'ok');
  });

  it('handles duplicate token registration', async () => {
    const token = `ExponentPushToken[dup-${Date.now()}]`;

    await app.service('sire-push-tokens').create({
      action: 'register',
      token,
      platform: 'android',
    }, {
      patient: { id: patient.id, organizationId: org.id },
    } as any);

    // Register same token again — should not throw
    const result: any = await app.service('sire-push-tokens').create({
      action: 'register',
      token,
      platform: 'android',
    }, {
      patient: { id: patient.id, organizationId: org.id },
    } as any);

    assert.strictEqual(result.status, 'ok');

    // Verify only one record exists
    const sequelize = app.get('sequelizeClient');
    const records = await sequelize.models.sire_push_tokens.findAll({
      where: { token },
      raw: true,
    });
    assert.strictEqual(records.length, 1, 'Should have exactly one record');
  });

  it('unregisters a push token', async () => {
    const token = `ExponentPushToken[unreg-${Date.now()}]`;

    await app.service('sire-push-tokens').create({
      action: 'register',
      token,
      platform: 'ios',
    }, {
      patient: { id: patient.id, organizationId: org.id },
    } as any);

    const result: any = await app.service('sire-push-tokens').create({
      action: 'unregister',
      token,
    }, {
      patient: { id: patient.id, organizationId: org.id },
    } as any);

    assert.strictEqual(result.status, 'ok');

    // Verify token is gone
    const sequelize = app.get('sequelizeClient');
    const records = await sequelize.models.sire_push_tokens.findAll({
      where: { token },
      raw: true,
    });
    assert.strictEqual(records.length, 0, 'Token should be deleted');
  });
});
