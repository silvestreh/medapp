import assert from 'assert';
import app from '../../src/app';

describe('\'patient-otp\' service', () => {
  const testDocumentValue = `otptest${Date.now()}`;
  const testOrgSlugAuth = `auth-org-${Date.now()}`;
  let patientId: string;

  it('registered the service', () => {
    const service = app.service('patient-otp');
    assert.ok(service, 'Registered the service');
  });

  describe('request-otp', () => {
    before(async () => {
      await app.service('organizations').create({
        name: 'Auth Test Org',
        slug: testOrgSlugAuth,
        settings: {},
      } as any);

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
      assert.ok(result.maskedPhone, 'Should return a masked phone');
      assert.equal(result.maskedPhone, '******0000');
    });

    it('returns not_found for a non-existent document', async () => {
      const result: any = await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: 'nonexistent99999',
      });

      assert.equal(result.action, 'request-otp');
      assert.equal(result.status, 'not_found');
    });

    it('returns no_phone for a patient without phone number', async () => {
      const noPhoneDoc = `nophone${Date.now()}`;
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

  describe('patient-otp authentication strategy', () => {
    it('returns accessToken with valid OTP via authenticate', async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      const service = app.service('patient-otp') as any;
      const pending = service.pendingOtps.get(testDocumentValue);
      assert.ok(pending, 'OTP should be stored');

      const result: any = await app.service('authentication').create({
        strategy: 'patient-otp',
        documentNumber: testDocumentValue,
        slug: testOrgSlugAuth,
        code: pending.code,
      }, {});

      assert.ok(result.accessToken, 'Should return an accessToken');
      assert.equal(result.patient.id, patientId);
      assert.ok(result.patient.organizationId, 'Should return organizationId');
    });

    it('throws NotAuthenticated with wrong code', async () => {
      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: testDocumentValue,
      });

      try {
        await app.service('authentication').create({
          strategy: 'patient-otp',
          documentNumber: testDocumentValue,
          slug: testOrgSlugAuth,
          code: '000000',
        }, {});
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
      }
    });

    it('throws NotAuthenticated when no OTP was requested', async () => {
      try {
        await app.service('authentication').create({
          strategy: 'patient-otp',
          documentNumber: 'neverrequested99',
          slug: testOrgSlugAuth,
          code: '123456',
        }, {});
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
      }
    });
  });

  describe('get-organization', () => {
    let testOrgSlug: string;

    before(async () => {
      testOrgSlug = `test-org-${Date.now()}`;
      await app.service('organizations').create({
        name: 'Test Organization',
        slug: testOrgSlug,
        settings: {
          healthCenter: {
            email: 'test@example.com',
            phone: '123-456-7890',
            address: '123 Test St',
            logoUrl: 'https://example.com/logo.png',
          },
        },
      } as any);
    });

    it('returns organization info for a valid slug', async () => {
      const result: any = await app.service('patient-otp').create({
        action: 'get-organization',
        slug: testOrgSlug,
      });

      assert.equal(result.action, 'get-organization');
      assert.equal(result.organization.name, 'Test Organization');
      assert.equal(result.organization.slug, testOrgSlug);
      assert.equal(result.organization.email, 'test@example.com');
      assert.equal(result.organization.phone, '123-456-7890');
      assert.equal(result.organization.address, '123 Test St');
      assert.equal(result.organization.logoUrl, 'https://example.com/logo.png');
    });

    it('throws BadRequest for non-existent slug', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'get-organization',
          slug: 'does-not-exist-99999',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });

    it('throws BadRequest when slug is missing', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'get-organization',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });

    it('returns null for missing healthCenter fields', async () => {
      const bareSlug = `bare-org-${Date.now()}`;
      await app.service('organizations').create({
        name: 'Bare Org',
        slug: bareSlug,
        settings: {},
      } as any);

      const result: any = await app.service('patient-otp').create({
        action: 'get-organization',
        slug: bareSlug,
      });

      assert.equal(result.organization.name, 'Bare Org');
      assert.equal(result.organization.logoUrl, null);
      assert.equal(result.organization.address, null);
      assert.equal(result.organization.phone, null);
      assert.equal(result.organization.email, null);
    });
  });

  describe('input validation', () => {
    it('rejects get-organization with a scanner probe slug (.s3cfg)', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'get-organization',
          slug: '.s3cfg',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });

    it('rejects get-organization with path traversal slug', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'get-organization',
          slug: '../etc/passwd',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });

    it('rejects get-organization with uppercase slug', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'get-organization',
          slug: 'UPPERCASE',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });

    it('rejects request-otp with special characters in document number', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'request-otp',
          documentNumber: 'doc-with-hyphens',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
        assert.equal(error.message, 'Invalid document number');
      }
    });

    it('rejects request-otp with overly long document number', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'request-otp',
          documentNumber: 'a'.repeat(51),
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
        assert.equal(error.message, 'Invalid document number');
      }
    });

    it('rejects unsupported action', async () => {
      try {
        await app.service('patient-otp').create({
          action: 'steal-data',
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
        assert.equal(error.message, 'Unsupported action');
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
      const otpResult: any = await app.service('authentication').create({
        strategy: 'patient-otp',
        documentNumber: testDocumentValue,
        slug: testOrgSlugAuth,
        code: pending.code,
      }, {});

      const result: any = await app.service('booking').find({
        provider: 'rest',
        headers: {
          authorization: `Bearer ${otpResult.accessToken}`,
        },
      });

      assert.ok(result, 'Should return a result');
      assert.equal(result.patientId, patientId);
    });

    it('rejects patient token on non-booking services', async () => {
      const isolatedDoc = `isolated${Date.now()}`;
      await app.service('patients').create({
        personalData: {
          firstName: 'Isolated',
          lastName: 'Patient',
          documentValue: isolatedDoc,
        },
        contactData: {
          phoneNumber: ['tel:1155550000'],
        },
      } as any);

      await app.service('patient-otp').create({
        action: 'request-otp',
        documentNumber: isolatedDoc,
      });

      const service = app.service('patient-otp') as any;
      const pending = service.pendingOtps.get(isolatedDoc);
      const otpResult: any = await app.service('authentication').create({
        strategy: 'patient-otp',
        documentNumber: isolatedDoc,
        slug: testOrgSlugAuth,
        code: pending.code,
      }, {});

      try {
        await app.service('users').find({
          provider: 'rest',
          headers: {
            authorization: `Bearer ${otpResult.accessToken}`,
          },
        });
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
      }
    });
  });
});
