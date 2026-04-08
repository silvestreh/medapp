import assert from 'assert';
import http from 'http';
import app from '../../src/app';
import { createTestOrganization, createTestUser } from '../test-helpers';

describe('recetario share action', () => {
  let orgId: string;
  let userId: string;
  let prescriptionId: string;
  let orderPrescriptionId: string;
  let pdfServer: http.Server;
  let pdfServerUrl: string;

  // Capture calls to whatsapp and mailer services
  const whatsappCalls: any[] = [];
  const mailerCalls: any[] = [];
  let originalWhatsappCreate: any;
  let originalMailerCreate: any;

  // Internal params bypass auth hooks — we're testing handleShare logic, not auth
  const internalParams = () => ({ organizationId: orgId, user: { id: userId } } as any);

  before(async () => {
    // Start a tiny HTTP server that serves a fake PDF
    pdfServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(Buffer.from('%PDF-1.4 fake'));
    });
    await new Promise<void>((resolve) => {
      pdfServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = pdfServer.address() as { port: number };
    pdfServerUrl = `http://127.0.0.1:${addr.port}/prescription.pdf`;

    const org = await createTestOrganization({ name: 'Recetario Share Test Org' });
    orgId = (org as any).id;

    const user = await createTestUser({
      username: `recshare-${Date.now()}@test.com`,
      password: 'Test1234!',
      roleIds: [],
      organizationId: orgId,
    });
    userId = String(user.id);

    const docNum = `${Date.now()}`;
    const patient = await app.service('patients').create({
      personalData: { firstName: 'Test', lastName: 'Patient', documentType: 'DNI', documentValue: docNum },
      contactData: { phone: '1234567890' },
    } as any);
    const patientId = String((patient as any).id);

    // Create a prescription record
    const prescription = await app.service('prescriptions').create({
      organizationId: orgId,
      medicId: userId,
      patientId,
      recetarioReference: `ref-${Date.now()}-rx`,
      type: 'prescription',
      status: 'completed',
      recetarioDocumentIds: [{ id: 999, type: 'prescription', url: pdfServerUrl }],
      content: { diagnosis: 'test' },
    } as any);
    prescriptionId = (prescription as any).id;

    // Create an order record
    const order = await app.service('prescriptions').create({
      organizationId: orgId,
      medicId: userId,
      patientId,
      recetarioReference: `ref-${Date.now()}-ord`,
      type: 'order',
      status: 'completed',
      recetarioDocumentIds: [{ id: 1000, type: 'order', url: pdfServerUrl }],
      content: { diagnosis: 'test order' },
    } as any);
    orderPrescriptionId = (order as any).id;

    // Stub whatsapp service
    originalWhatsappCreate = app.service('whatsapp').create.bind(app.service('whatsapp'));
    (app.service('whatsapp') as any).create = async (data: any) => {
      whatsappCalls.push(data);
      return { sent: true, messageId: 'test-msg-id' };
    };

    // Stub mailer service
    originalMailerCreate = app.service('mailer').create.bind(app.service('mailer'));
    (app.service('mailer') as any).create = async (data: any) => {
      mailerCalls.push(data);
      return { sent: true };
    };
  });

  beforeEach(() => {
    whatsappCalls.length = 0;
    mailerCalls.length = 0;
  });

  after(async () => {
    (app.service('whatsapp') as any).create = originalWhatsappCreate;
    (app.service('mailer') as any).create = originalMailerCreate;
    await new Promise<void>((resolve) => pdfServer.close(() => resolve()));
  });

  it('shares a prescription via whatsapp with base64 media', async () => {
    const result = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.ok(result.success);
    assert.equal(whatsappCalls.length, 1);
    assert.equal(whatsappCalls[0].organizationId, orgId);
    assert.equal(whatsappCalls[0].to, '5492214567890');
    assert.equal(whatsappCalls[0].filename, 'receta.pdf');
    assert.ok(whatsappCalls[0].media, 'should send base64 media');
    assert.equal(typeof whatsappCalls[0].media, 'string');
    assert.ok(!whatsappCalls[0].documentUrl, 'should NOT send documentUrl');
  });

  it('shares an order via whatsapp with correct filename', async () => {
    const result = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId: orderPrescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.ok(result.success);
    assert.equal(whatsappCalls.length, 1);
    assert.equal(whatsappCalls[0].filename, 'orden.pdf');
    assert.ok(whatsappCalls[0].media);
  });

  it('shares a prescription via email', async () => {
    const result = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'email',
      shareRecipient: 'patient@example.com',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.ok(result.success);
    assert.equal(mailerCalls.length, 1);
    assert.equal(mailerCalls[0].to, 'patient@example.com');
    assert.equal(mailerCalls[0].template, 'prescription-share');
    assert.equal(mailerCalls[0].attachments[0].filename, 'receta.pdf');
    assert.equal(mailerCalls[0].attachments[0].contentType, 'application/pdf');
    assert.ok(Buffer.isBuffer(mailerCalls[0].attachments[0].data));
  });

  it('shares an order via email with correct subject and filename', async () => {
    const result = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'email',
      shareRecipient: 'patient@example.com',
      prescriptionId: orderPrescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.ok(result.success);
    assert.equal(mailerCalls[0].subject, 'Nueva orden médica');
    assert.equal(mailerCalls[0].attachments[0].filename, 'orden.pdf');
  });

  it('updates prescription record with sharedVia and sharedTo', async () => {
    await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    const updated = await app.service('prescriptions').get(prescriptionId) as any;
    assert.equal(updated.sharedVia, 'whatsapp');
    assert.equal(updated.sharedTo, '5492214567890');
  });

  it('throws if pdfUrl is missing', async () => {
    try {
      await app.service('recetario').create({
        action: 'share',
        shareChannel: 'whatsapp',
        shareRecipient: '5492214567890',
        prescriptionId,
      } as any, internalParams());
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
    }
  });

  it('throws if shareChannel is missing', async () => {
    try {
      await app.service('recetario').create({
        action: 'share',
        shareRecipient: '5492214567890',
        prescriptionId,
        pdfUrl: pdfServerUrl,
      } as any, internalParams());
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
    }
  });

  it('throws if shareRecipient is missing', async () => {
    try {
      await app.service('recetario').create({
        action: 'share',
        shareChannel: 'whatsapp',
        prescriptionId,
        pdfUrl: pdfServerUrl,
      } as any, internalParams());
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
    }
  });

  it('accepts pdfUrl from any domain (no hostname validation)', async () => {
    // The key fix: pdfUrl from any host works — no domain restriction
    const result = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.ok(result.success);
    assert.equal(whatsappCalls.length, 1);
  });
});
