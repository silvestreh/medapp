import assert from 'assert';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';

const CERT_PATH = path.join(__dirname, '../fixtures/test-certificate.p12');
const CERT_PASSWORD = 'test1234';

describe('\'document-verification\' service', () => {
  let org: any;
  let medic: any;
  let patient: any;
  let signedPdf: Buffer;
  let signedHash: string;

  before(async () => {
    const p12Buffer = fs.readFileSync(CERT_PATH);

    org = await app.service('organizations').create({
      name: 'Verification Test Clinic',
      slug: `verification-test-${Date.now()}`,
      settings: {},
      isActive: true,
    });

    medic = await app.service('users').create({
      username: `verify.test.medic.${Date.now()}`,
      password: 'SuperSecret1!',
      personalData: {
        firstName: 'Verify',
        lastName: 'Doctor',
        documentType: 'DNI',
        documentValue: `VD${Date.now()}`,
      },
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: medic.id,
    } as any);

    await app.service('user-roles').create({
      userId: medic.id,
      roleId: 'medic',
      organizationId: org.id,
    } as any);

    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Verify',
        lastName: 'Patient',
        documentType: 'DNI',
        documentValue: `VP${Date.now()}`,
      },
    });

    await app.service('encounters').create({
      date: new Date('2024-01-15'),
      medicId: medic.id,
      patientId: patient.id,
      data: { clinicalNotes: { values: { notes: 'Verification test encounter' } } },
    });

    // Upload certificate
    await app.service('signing-certificates').create(
      { userId: medic.id } as any,
      {
        file: {
          originalname: 'test-certificate.p12',
          buffer: p12Buffer,
        },
      } as any
    );

    // Generate a signed PDF
    const result: any = await app.service('signed-exports').create({
      patientId: patient.id,
      content: 'encounters',
      certificatePassword: CERT_PASSWORD,
      delivery: 'download',
    }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

    signedPdf = result.pdf;
    signedHash = result.hash;
  });

  it('registered the service', () => {
    const service = app.service('document-verification');
    assert.ok(service, 'Registered the service');
  });

  it('verifies a signed PDF matches stored hash', async () => {
    const result: any = await app.service('document-verification').create(
      {},
      {
        file: {
          originalname: 'test.pdf',
          buffer: signedPdf,
        },
      } as any
    );

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.hashMatch, true);
    assert.strictEqual(result.storedRecord, true);
    assert.ok(result.signerName, 'Signer name is present');
    assert.ok(result.signedAt, 'Signed date is present');
    assert.strictEqual(result.patientId, patient.id);
    assert.strictEqual(result.signedById, medic.id);
  });

  it('detects tampered PDF (hash mismatch)', async () => {
    const tampered = Buffer.from(signedPdf);
    // Modify a byte near the end (avoiding the PDF header)
    tampered[tampered.length - 10] = tampered[tampered.length - 10] ^ 0xff;

    const result: any = await app.service('document-verification').create(
      {},
      {
        file: {
          originalname: 'tampered.pdf',
          buffer: tampered,
        },
      } as any
    );

    assert.strictEqual(result.hashMatch, false);
    assert.strictEqual(result.storedRecord, false);
    assert.strictEqual(result.isValid, false);
  });

  it('reports no stored record for unknown PDF', async () => {
    // Create a minimal fake PDF
    const fakePdf = Buffer.from('%PDF-1.4 fake content');

    const result: any = await app.service('document-verification').create(
      {},
      {
        file: {
          originalname: 'unknown.pdf',
          buffer: fakePdf,
        },
      } as any
    );

    assert.strictEqual(result.storedRecord, false);
    assert.strictEqual(result.hashMatch, false);
    assert.strictEqual(result.isValid, false);
  });

  it('rejects non-PDF files', async () => {
    try {
      await app.service('document-verification').create(
        {},
        {
          file: {
            originalname: 'test.txt',
            buffer: Buffer.from('not a pdf'),
          },
        } as any
      );
      assert.fail('Should throw BadRequest');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
    }
  });

  it('signed export returns hash in result', () => {
    assert.ok(signedHash, 'Hash is present in signed export result');
    assert.strictEqual(signedHash.length, 64, 'Hash is 64 characters (SHA-256 hex)');
  });
});
