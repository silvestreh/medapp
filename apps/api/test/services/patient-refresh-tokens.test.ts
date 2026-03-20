import assert from 'assert';
import app from '../../src/app';
import { createTestOrganization } from '../test-helpers';

describe('\'patient-refresh-tokens\' service', () => {
  const testDocumentValue = `refresh-test-${Date.now()}`;
  const testOrgSlug = `refresh-org-${Date.now()}`;
  let patientId: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let orgId: string;

  before(async () => {
    const org = await createTestOrganization({ slug: testOrgSlug });
    orgId = String(org.id);

    const patient = await app.service('patients').create({
      personalData: {
        firstName: 'Refresh',
        lastName: 'Patient',
        documentValue: testDocumentValue,
      },
      contactData: {
        phoneNumber: ['cel:1155559999'],
      },
    } as any);
    patientId = String(patient.id);
  });

  it('registered the service', () => {
    const service = app.service('patient-refresh-tokens');
    assert.ok(service, 'Registered the service');
  });

  describe('OTP with sire app returns refresh token', () => {
    it('returns both accessToken and refreshToken for sire app', async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      const otpService = app.service('patient-otp') as any;
      const pending = otpService.pendingOtps.get(testDocumentValue);
      assert.ok(pending, 'OTP should be stored');

      const result: any = await app.service('authentication').create({
        strategy: 'patient-otp',
        documentNumber: testDocumentValue,
        slug: testOrgSlug,
        code: pending.code,
        app: 'sire',
      }, {});

      assert.ok(result.accessToken, 'Should return an accessToken');
      assert.ok(result.refreshToken, 'Should return a refreshToken');
      assert.strictEqual(result.patient.id, patientId);
    });
  });

  describe('refresh action', () => {
    let refreshToken: string;

    before(async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      const otpService = app.service('patient-otp') as any;
      const pending = otpService.pendingOtps.get(testDocumentValue);

      const result: any = await app.service('authentication').create({
        strategy: 'patient-otp',
        documentNumber: testDocumentValue,
        slug: testOrgSlug,
        code: pending.code,
        app: 'sire',
      }, {});

      refreshToken = result.refreshToken;
    });

    it('exchanges a valid refresh token for a new token pair', async () => {
      const result: any = await app.service('patient-refresh-tokens').create({
        action: 'refresh',
        refreshToken,
      });

      assert.ok(result.accessToken, 'Should return a new accessToken');
      assert.ok(result.refreshToken, 'Should return a new refreshToken');
      assert.notStrictEqual(result.refreshToken, refreshToken, 'New refresh token should differ');
      assert.strictEqual(result.patient.id, patientId);

      // Update for next test
      refreshToken = result.refreshToken;
    });

    it('rejects an already-used refresh token (reuse detection)', async () => {
      const oldToken = refreshToken;

      // Use the current token to get a new pair
      const result: any = await app.service('patient-refresh-tokens').create({
        action: 'refresh',
        refreshToken: oldToken,
      });
      refreshToken = result.refreshToken;

      // Try to reuse the old token — should fail and revoke family
      try {
        await app.service('patient-refresh-tokens').create({
          action: 'refresh',
          refreshToken: oldToken,
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.strictEqual(error.code, 401);
      }
    });

    it('rejects an invalid refresh token', async () => {
      try {
        await app.service('patient-refresh-tokens').create({
          action: 'refresh',
          refreshToken: 'invalid-token-that-does-not-exist',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.strictEqual(error.code, 401);
      }
    });

    it('throws BadRequest when refresh token is missing', async () => {
      try {
        await app.service('patient-refresh-tokens').create({
          action: 'refresh',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.strictEqual(error.code, 400);
      }
    });
  });
});
