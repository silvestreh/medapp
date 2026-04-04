import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'sire-push-tokens\' service', () => {
  let org: any;
  let accessToken: string;
  const testDocumentValue = `sirepush${Date.now()}`;
  const testOrgSlug = `sire-push-org-${Date.now()}`;

  before(async () => {
    org = await createTestOrganization({ slug: testOrgSlug });
    await createTestUser({
      username: `push.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    await app.service('patients').create({
      personalData: {
        firstName: 'Push',
        lastName: 'Patient',
        documentValue: testDocumentValue,
      },
      contactData: {
        phoneNumber: ['cel:1155550001'],
      },
    } as any);

    // Authenticate as the patient via OTP to get an access token
    await app.service('patient-otp').create({
      action: 'request-otp',
      documentNumber: testDocumentValue,
    });

    const otpService = app.service('patient-otp') as any;
    const pending = otpService.pendingOtps.get(testDocumentValue);

    const authResult: any = await app.service('authentication').create({
      strategy: 'patient-otp',
      documentNumber: testDocumentValue,
      slug: testOrgSlug,
      code: pending.code,
      app: 'sire',
    }, {});

    accessToken = authResult.accessToken;
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
      headers: { authorization: `Bearer ${accessToken}` },
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
      headers: { authorization: `Bearer ${accessToken}` },
    } as any);

    // Register same token again — should not throw
    const result: any = await app.service('sire-push-tokens').create({
      action: 'register',
      token,
      platform: 'android',
    }, {
      headers: { authorization: `Bearer ${accessToken}` },
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
      headers: { authorization: `Bearer ${accessToken}` },
    } as any);

    const result: any = await app.service('sire-push-tokens').create({
      action: 'unregister',
      token,
    }, {
      headers: { authorization: `Bearer ${accessToken}` },
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
