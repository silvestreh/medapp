import assert from 'assert';
import app from '../../src/app';

describe('\'patient-otp\' service', () => {
  const testDocumentValue = `otp-test-${Date.now()}`;
  let patientId: string;

  it('registered the service', () => {
    const service = app.service('patient-otp');
    assert.ok(service, 'Registered the service');
  });

  describe('request-otp', () => {
    before(async () => {
      const patient = await app.service('patients').create({
        personalData: {
          firstName: 'OTP',
          lastName: 'Test',
          documentValue: testDocumentValue,
        },
        contactData: {
          phoneNumber: ['tel:1155550000'],
        },
      } as any);
      patientId = String(patient.id);
    });

    it('returns otp_sent for a patient with phone number', async () => {
      const result: any = await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      assert.equal(result.action, 'request-otp');
      assert.equal(result.status, 'otp_sent');
    });

    it('returns not_found for a non-existent document', async () => {
      const result: any = await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: 'nonexistent-doc-99999',
      });

      assert.equal(result.action, 'request-otp');
      assert.equal(result.status, 'not_found');
    });

    it('returns no_phone for a patient without phone number', async () => {
      const noPhoneDoc = `no-phone-${Date.now()}`;
      await app.service('patients').create({
        personalData: {
          firstName: 'NoPhone',
          lastName: 'Patient',
          documentValue: noPhoneDoc,
        },
        contactData: {},
      } as any);

      const result: any = await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: noPhoneDoc,
      });

      assert.equal(result.action, 'request-otp');
      assert.equal(result.status, 'no_phone');
    });

    it('throws BadRequest when documentNumber is missing', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'request-otp',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });
  });

  describe('verify-otp', () => {
    it('returns accessToken with valid OTP', async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      // Extract the OTP from the service's internal state
      const service = app.service('patient-otp') as any;
      const pending = service.pendingOtps.get(testDocumentValue);
      assert.ok(pending, 'OTP should be stored');

      const result: any = await app.service('patient-otp').create({
        action: 'verify-otp',
        documentNumber: testDocumentValue,
        code: pending.code,
      });

      assert.equal(result.action, 'verify-otp');
      assert.equal(result.verified, true);
      assert.ok(result.accessToken, 'Should return an accessToken');
      assert.equal(result.patient.id, patientId);
    });

    it('throws NotAuthenticated with wrong code', async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      try {
        await app.service('patient-otp').create({
          action: 'verify-otp',
          documentNumber: testDocumentValue,
          code: '000000',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
      }
    });

    it('throws NotAuthenticated when no OTP was requested', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'verify-otp',
          documentNumber: 'never-requested-doc',
          code: '123456',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
      }
    });
  });

  describe('booking service', () => {
    it('registered the service', () => {
      const service = app.service('booking');
      assert.ok(service, 'Registered the service');
    });

    it('rejects requests without authentication', async () => {
      try {
        await app.service('booking').find({
          provider: 'rest',
          headers: {},
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
      }
    });

    it('allows access with valid patient token', async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      const service = app.service('patient-otp') as any;
      const pending = service.pendingOtps.get(testDocumentValue);
      const otpResult: any = await app.service('patient-otp').create({
        action: 'verify-otp',
        documentNumber: testDocumentValue,
        code: pending.code,
      });

      const result: any = await app.service('booking').find({
        provider: 'rest',
        headers: {
          authorization: `Bearer ${otpResult.accessToken}`,
        },
      });

      assert.ok(result, 'Should return a result');
      assert.equal(result.patientId, patientId);
    });
  });
});
