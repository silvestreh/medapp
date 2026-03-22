import assert from 'assert';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'crypto';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';

const CERT_PATH = path.join(__dirname, '../fixtures/test-certificate.p12');
const CERT_PASSWORD = 'test1234';
const TEST_PIN = 'mySecurePin99';

function encryptWithPin(data: Buffer, pin: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, encrypted, authTag]);
}

describe('\'signed-exports\' service', () => {
  let org: any;
  let medic: any;
  let patient: any;
  let study: any;
  let p12Buffer: Buffer;

  before(async () => {
    p12Buffer = fs.readFileSync(CERT_PATH);

    org = await app.service('organizations').create({
      name: 'Signed Exports Test Clinic',
      slug: `signed-exports-test-${Date.now()}`,
      settings: {},
      isActive: true,
    });

    medic = await app.service('users').create({
      username: 'export.test.medic',
      password: 'SuperSecret1!',
      personalData: {
        firstName: 'Export',
        lastName: 'Doctor',
        documentType: 'DNI',
        documentValue: '99000111',
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
      medicare: 'EXP-MED-001',
      medicareNumber: '999888777',
      personalData: {
        firstName: 'Jane',
        lastName: 'Patient',
        documentType: 'DNI',
        documentValue: '88000222',
      },
    });

    await app.service('encounters').create({
      date: new Date('2024-01-15'),
      medicId: medic.id,
      patientId: patient.id,
      data: {
        clinicalNotes: {
          values: { notes: 'First visit — January' },
        },
      },
    });

    await app.service('encounters').create({
      date: new Date('2024-06-15'),
      medicId: medic.id,
      patientId: patient.id,
      data: {
        clinicalNotes: {
          values: { notes: 'Follow-up visit — June' },
        },
      },
    });

    study = await app.service('studies').create({
      date: new Date('2024-03-10'),
      protocol: 5001,
      studies: ['anemia'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
    });

    await app.service('study-results').create({
      data: { hemoglobin: '12.5 g/dL' },
      studyId: study.id,
      type: 'anemia',
    });
  });

  it('registered the service', () => {
    const service = app.service('signed-exports');
    assert.ok(service, 'Registered the service');
  });

  describe('unsigned PDF generation', () => {
    it('generates PDF with encounters only', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'encounters',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(Buffer.isBuffer(result.pdf), 'PDF is a Buffer');
      assert.ok(result.pdf.length > 0, 'PDF is non-empty');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
      assert.ok(result.fileName, 'File name is present');
      assert.ok(result.fileName.endsWith('.pdf'), 'File name ends with .pdf');
    });

    it('generates PDF with studies only', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'studies',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
    });

    it('generates PDF with both encounters and studies', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
    });
  });

  describe('signed PDF generation', () => {
    before(async () => {
      await app.service('signing-certificates').create(
        { userId: medic.id } as any,
        {
          file: {
            originalname: 'test-certificate.p12',
            buffer: p12Buffer,
          },
        } as any
      );
    });

    after(async () => {
      const certs = await app.service('signing-certificates').find({
        query: { userId: medic.id },
        paginate: false,
      } as any) as any[];
      for (const cert of certs) {
        await app.service('signing-certificates').remove(cert.id);
      }
    });

    it('generates signed PDF when certificate and password are provided', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        certificatePassword: CERT_PASSWORD,
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Signed PDF starts with %PDF header'
      );
    });

    it('stores document signature hash after signing', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        certificatePassword: CERT_PASSWORD,
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.ok(result.hash, 'Hash is returned in result');
      assert.strictEqual(result.hash.length, 64, 'Hash is 64 characters (SHA-256 hex)');

      const signatures = await app.service('document-signatures').find({
        query: { hash: result.hash },
        paginate: false,
        provider: undefined,
      } as any) as any[];

      assert.strictEqual(signatures.length, 1, 'One signature record created');
      assert.strictEqual(signatures[0].signedById, medic.id);
      assert.strictEqual(signatures[0].patientId, patient.id);
      assert.ok(signatures[0].signerName, 'Signer name is stored');
      assert.ok(signatures[0].signedAt, 'Signed date is stored');
      assert.ok(signatures[0].fileName, 'File name is stored');
    });

    it('does not store hash for unsigned PDFs', async () => {
      const beforeSigs = await app.service('document-signatures').find({
        query: { signedById: medic.id },
        paginate: false,
        provider: undefined,
      } as any) as any[];

      const beforeCount = beforeSigs.length;

      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.ok(!result.hash, 'No hash for unsigned PDF');

      const afterSigs = await app.service('document-signatures').find({
        query: { signedById: medic.id },
        paginate: false,
        provider: undefined,
      } as any) as any[];

      assert.strictEqual(afterSigs.length, beforeCount, 'No new signature record created');
    });
  });

  describe('error handling', () => {
    it('fails to sign when no certificate is uploaded', async () => {
      const noCertMedic = await app.service('users').create({
        username: 'export.nocert.medic',
        password: 'SuperSecret1!',
      });

      await app.service('organization-users').create({
        organizationId: org.id,
        userId: noCertMedic.id,
      } as any);

      await app.service('user-roles').create({
        userId: noCertMedic.id,
        roleId: 'medic',
        organizationId: org.id,
      } as any);

      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          certificatePassword: 'some-password',
          delivery: 'download',
        }, { user: noCertMedic, orgRoleIds: ['medic'], organizationId: org.id } as any);
        assert.fail('Should throw BadRequest');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.ok(error.message.includes('certificate'), 'Error mentions certificate');
      }
    });

    it('rejects unauthorized roles (e.g. receptionist)', async () => {
      const receptionist = await app.service('users').create({
        username: 'export.receptionist',
        password: 'SuperSecret1!',
      });

      await app.service('organization-users').create({
        organizationId: org.id,
        userId: receptionist.id,
      } as any);

      await app.service('user-roles').create({
        userId: receptionist.id,
        roleId: 'receptionist',
        organizationId: org.id,
      } as any);

      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          delivery: 'download',
        }, { user: receptionist, orgRoleIds: ['receptionist'], organizationId: org.id } as any);
        assert.fail('Should throw Forbidden');
      } catch (error: any) {
        assert.strictEqual(error.name, 'Forbidden');
      }
    });

    it('rejects when no user is provided', async () => {
      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          delivery: 'download',
        }, {} as any);
        assert.fail('Should throw Forbidden');
      } catch (error: any) {
        assert.strictEqual(error.name, 'Forbidden');
      }
    });
  });

  describe('lab-tech and lab-owner access', () => {
    let labTech: any;
    let labOwner: any;

    before(async () => {
      labTech = await app.service('users').create({
        username: 'export.labtech',
        password: 'SuperSecret1!',
        personalData: {
          firstName: 'Lab',
          lastName: 'Tech',
          documentType: 'DNI',
          documentValue: '55000111',
        },
      });

      labOwner = await app.service('users').create({
        username: 'export.labowner',
        password: 'SuperSecret1!',
        personalData: {
          firstName: 'Lab',
          lastName: 'Owner',
          documentType: 'DNI',
          documentValue: '55000222',
        },
      });

      await app.service('organization-users').create({ organizationId: org.id, userId: labTech.id } as any);
      await app.service('organization-users').create({ organizationId: org.id, userId: labOwner.id } as any);
      await app.service('user-roles').create({ userId: labTech.id, roleId: 'lab-tech', organizationId: org.id } as any);
      await app.service('user-roles').create({ userId: labOwner.id, roleId: 'lab-owner', organizationId: org.id } as any);
    });

    it('allows lab-tech to generate unsigned PDF for a single study', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        studyId: study.id,
        content: 'studies',
        delivery: 'download',
      }, { user: labTech, orgRoleIds: ['lab-tech'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(Buffer.isBuffer(result.pdf), 'PDF is a Buffer');
      assert.ok(result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'), 'Starts with %PDF header');
    });

    it('allows lab-owner to generate unsigned PDF for a single study', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        studyId: study.id,
        content: 'studies',
        delivery: 'download',
      }, { user: labOwner, orgRoleIds: ['lab-owner'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(Buffer.isBuffer(result.pdf), 'PDF is a Buffer');
      assert.ok(result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'), 'Starts with %PDF header');
    });
  });

  describe('print (unsigned download) flow', () => {
    it('generates an unsigned PDF with both encounters and studies for printing', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(Buffer.isBuffer(result.pdf), 'PDF is a Buffer');
      assert.ok(result.pdf.length > 0, 'PDF is non-empty');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
      assert.ok(result.fileName, 'File name is present');
      assert.ok(result.fileName.endsWith('.pdf'), 'File name ends with .pdf');
    });

    it('produces unsigned PDF without signature artifacts', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      const pdfText = result.pdf.toString('utf-8');
      assert.strictEqual(pdfText.includes('/Type /Sig'), false, 'No /Type /Sig in unsigned PDF');
      assert.strictEqual(pdfText.includes('/SubFilter'), false, 'No /SubFilter in unsigned PDF');
    });

    it('generates unsigned PDF with encounters only for printing', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'encounters',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
    });

    it('generates unsigned PDF with studies only for printing', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'studies',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
    });

    it('generates unsigned PDF with date range filtering for printing', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        content: 'both',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'PDF starts with %PDF header'
      );
      assert.ok(result.fileName, 'File name is present');
    });

    it('generates unsigned PDF with locale parameter for printing', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        delivery: 'download',
        locale: 'es',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(result.fileName, 'File name is present');
    });
  });

  describe('single study export via studyId', () => {
    it('generates PDF for a single study by studyId', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        studyId: study.id,
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(Buffer.isBuffer(result.pdf), 'PDF is a Buffer');
      assert.ok(result.pdf.length > 0, 'PDF is non-empty');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
      assert.ok(result.fileName, 'File name is present');
      assert.ok(result.fileName.endsWith('.pdf'), 'File name ends with .pdf');
    });

    it('ignores date range when studyId is provided', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        studyId: study.id,
        startDate: '2099-01-01',
        endDate: '2099-12-31',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF is still generated despite out-of-range dates');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Starts with %PDF header'
      );
    });

    it('returns error for non-existent studyId', async () => {
      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          studyId: '00000000-0000-0000-0000-000000000000',
          delivery: 'download',
        }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);
        assert.fail('Should throw NotFound');
      } catch (error: any) {
        assert.strictEqual(error.name, 'NotFound');
      }
    });
  });

  describe('date range filtering', () => {
    it('filters encounters by date range', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        content: 'encounters',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'PDF starts with %PDF header'
      );
    });

    it('generates PDF for full date range', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        delivery: 'download',
      }, { user: medic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
    });
  });

  describe('client-encrypted certificate signing', () => {
    let encryptedMedic: any;

    before(async () => {
      encryptedMedic = await app.service('users').create({
        username: 'export.encrypted.medic',
        password: 'SuperSecret1!',
        personalData: {
          firstName: 'Encrypted',
          lastName: 'Doctor',
          documentType: 'DNI',
          documentValue: '77000333',
        },
      });

      await app.service('organization-users').create({
        organizationId: org.id,
        userId: encryptedMedic.id,
      } as any);

      await app.service('user-roles').create({
        userId: encryptedMedic.id,
        roleId: 'medic',
        organizationId: org.id,
      } as any);

      const encryptedCert = encryptWithPin(p12Buffer, TEST_PIN);

      await app.service('signing-certificates').create(
        { userId: encryptedMedic.id, isClientEncrypted: true } as any,
        {
          file: {
            originalname: 'test-certificate.p12',
            buffer: encryptedCert,
          },
          isClientEncrypted: true,
        } as any
      );
    });

    after(async () => {
      const certs = await app.service('signing-certificates').find({
        query: { userId: encryptedMedic.id },
        paginate: false,
      } as any) as any[];
      for (const cert of certs) {
        await app.service('signing-certificates').remove(cert.id);
      }
    });

    it('signs PDF when correct PIN and certificate password are provided', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        content: 'both',
        certificatePassword: CERT_PASSWORD,
        encryptionPin: TEST_PIN,
        delivery: 'download',
      }, { user: encryptedMedic, orgRoleIds: ['medic'], organizationId: org.id } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Signed PDF starts with %PDF header'
      );
    });

    it('fails with wrong PIN', async () => {
      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          content: 'both',
          certificatePassword: CERT_PASSWORD,
          encryptionPin: 'wrong-pin',
          delivery: 'download',
        }, { user: encryptedMedic, orgRoleIds: ['medic'], organizationId: org.id } as any);
        assert.fail('Should throw BadRequest');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.ok(error.message.includes('PIN'), 'Error mentions PIN');
      }
    });

    it('fails when PIN is omitted for an encrypted certificate', async () => {
      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          content: 'both',
          certificatePassword: CERT_PASSWORD,
          delivery: 'download',
        }, { user: encryptedMedic, orgRoleIds: ['medic'], organizationId: org.id } as any);
        assert.fail('Should throw BadRequest');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.ok(error.message.includes('PIN'), 'Error mentions PIN');
      }
    });

    it('stores isClientEncrypted flag on the certificate record', async () => {
      const certs = await app.service('signing-certificates').find({
        query: { userId: encryptedMedic.id },
        paginate: false,
      } as any) as any[];

      assert.strictEqual(certs.length, 1);
      assert.strictEqual(certs[0].isClientEncrypted, true);
    });
  });
});
