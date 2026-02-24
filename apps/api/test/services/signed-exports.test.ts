import assert from 'assert';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';

const CERT_PATH = path.join(__dirname, '../fixtures/test-certificate.p12');
const CERT_PASSWORD = 'test1234';

describe('\'signed-exports\' service', () => {
  let medic: any;
  let patient: any;
  let p12Buffer: Buffer;

  before(async () => {
    p12Buffer = fs.readFileSync(CERT_PATH);

    medic = await app.service('users').create({
      username: 'export.test.medic',
      password: 'SuperSecret1',
      roleId: 'medic',
      personalData: {
        firstName: 'Export',
        lastName: 'Doctor',
        documentType: 'DNI',
        documentValue: '99000111',
      },
    });

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

    const study = await app.service('studies').create({
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
      }, { user: medic } as any);

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
      }, { user: medic } as any);

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
      }, { user: medic } as any);

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
      }, { user: medic } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
      assert.ok(
        result.pdf.toString('utf-8', 0, 5).startsWith('%PDF'),
        'Signed PDF starts with %PDF header'
      );
    });
  });

  describe('error handling', () => {
    it('fails to sign when no certificate is uploaded', async () => {
      const noCertMedic = await app.service('users').create({
        username: 'export.nocert.medic',
        password: 'SuperSecret1',
        roleId: 'medic',
      });

      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          certificatePassword: 'some-password',
          delivery: 'download',
        }, { user: noCertMedic } as any);
        assert.fail('Should throw BadRequest');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.ok(error.message.includes('certificate'), 'Error mentions certificate');
      }
    });

    it('rejects non-medic users', async () => {
      const receptionist = await app.service('users').create({
        username: 'export.receptionist',
        password: 'SuperSecret1',
        roleId: 'receptionist',
      });

      try {
        await app.service('signed-exports').create({
          patientId: patient.id,
          delivery: 'download',
        }, { user: receptionist } as any);
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

  describe('date range filtering', () => {
    it('filters encounters by date range', async () => {
      const result: any = await app.service('signed-exports').create({
        patientId: patient.id,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        content: 'encounters',
        delivery: 'download',
      }, { user: medic } as any);

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
      }, { user: medic } as any);

      assert.strictEqual(result.success, true);
      assert.ok(result.pdf, 'PDF buffer is present');
    });
  });
});
