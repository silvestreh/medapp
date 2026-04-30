import assert from 'assert';
import http from 'http';
import app from '../../src/app';
import { createTestOrganization, createTestUser } from '../test-helpers';
import { setPdfFetchTimeoutForTesting } from '../../src/services/recetario/recetario.class';

describe('recetario share action', () => {
  let orgId: string;
  let userId: string;
  let prescriptionId: string;
  let orderPrescriptionId: string;
  let pdfServer: http.Server;
  let pdfServerUrl: string;
  let pdfHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

  // Capture calls to whatsapp and mailer services
  const whatsappCalls: any[] = [];
  const mailerCalls: any[] = [];
  let originalWhatsappCreate: any;
  let originalMailerCreate: any;

  // Internal params bypass auth hooks — we're testing handleShare logic, not auth
  const internalParams = () => ({ organizationId: orgId, user: { id: userId } } as any);

  // Default handler: serve a fake PDF immediately.
  const okHandler = (_req: http.IncomingMessage, res: http.ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(Buffer.from('%PDF-1.4 fake'));
  };

  before(async () => {
    pdfHandler = okHandler;
    pdfServer = http.createServer((req, res) => pdfHandler(req, res));
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

  beforeEach(async () => {
    whatsappCalls.length = 0;
    mailerCalls.length = 0;
    pdfHandler = okHandler;
    setPdfFetchTimeoutForTesting(30_000);
    // Reset share state between tests so the idempotency window doesn't bleed
    // a previous test's share into this one.
    if (prescriptionId) {
      await app.service('prescriptions').patch(
        prescriptionId,
        { sharedVia: null, sharedTo: null, lastSharedAt: null } as any
      );
    }
    if (orderPrescriptionId) {
      await app.service('prescriptions').patch(
        orderPrescriptionId,
        { sharedVia: null, sharedTo: null, lastSharedAt: null } as any
      );
    }
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

  it('retries the PDF fetch on a transient 504 and ultimately succeeds', async () => {
    let calls = 0;
    pdfHandler = (_req, res) => {
      calls += 1;
      if (calls === 1) {
        res.writeHead(504);
        res.end('upstream timeout');
        return;
      }
      okHandler(_req, res);
    };

    const result = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.ok(result.success);
    assert.equal(calls, 2, 'second attempt should have hit the server');
    assert.equal(whatsappCalls.length, 1);
  });

  it('throws a recetario:-prefixed error after retries exhaust on 5xx', async () => {
    let calls = 0;
    pdfHandler = (_req, res) => {
      calls += 1;
      res.writeHead(504);
      res.end('upstream timeout');
    };

    try {
      await app.service('recetario').create({
        action: 'share',
        shareChannel: 'whatsapp',
        shareRecipient: '5492214567890',
        prescriptionId,
        pdfUrl: pdfServerUrl,
      } as any, internalParams());
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
      assert.match(error.message, /^recetario:/, 'error should be classified for the UI');
      assert.match(error.message, /504/);
    }
    // 1 initial + 2 retries = 3 attempts
    assert.equal(calls, 3);
    assert.equal(whatsappCalls.length, 0, 'whatsapp should not be called when PDF fetch fails');
  });

  it('throws a timeout-classified error when the PDF fetch hangs', async () => {
    setPdfFetchTimeoutForTesting(150);
    pdfHandler = () => {
      // Never respond — let the request time out.
    };

    try {
      await app.service('recetario').create({
        action: 'share',
        shareChannel: 'whatsapp',
        shareRecipient: '5492214567890',
        prescriptionId,
        pdfUrl: pdfServerUrl,
      } as any, internalParams());
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
      assert.match(error.message, /recetario.*timeout/i, 'should hit isRecetarioUnavailable bucket');
    }
    assert.equal(whatsappCalls.length, 0);
  });

  it('does not retry on 4xx and surfaces an invalid-link error', async () => {
    let calls = 0;
    pdfHandler = (_req, res) => {
      calls += 1;
      res.writeHead(404);
      res.end('not found');
    };

    try {
      await app.service('recetario').create({
        action: 'share',
        shareChannel: 'whatsapp',
        shareRecipient: '5492214567890',
        prescriptionId,
        pdfUrl: pdfServerUrl,
      } as any, internalParams());
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
      assert.match(error.message, /^recetario:/);
      assert.match(error.message, /404/);
    }
    assert.equal(calls, 1, '4xx should not be retried');
  });

  it('deduplicates a second share to the same channel+recipient inside the window', async () => {
    const sharePayload = {
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    };

    const first = await app.service('recetario').create(sharePayload as any, internalParams());
    assert.ok(first.success);
    assert.ok(!first.deduplicated, 'first call should send');

    const second = await app.service('recetario').create(sharePayload as any, internalParams());
    assert.ok(second.success);
    assert.equal(second.deduplicated, true, 'second call should be deduplicated');
    assert.equal(whatsappCalls.length, 1, 'whatsapp should only be called once');
  });

  it('does not deduplicate when the recipient is different', async () => {
    await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5499998888888',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());

    assert.equal(whatsappCalls.length, 2);
    assert.equal(whatsappCalls[0].to, '5492214567890');
    assert.equal(whatsappCalls[1].to, '5499998888888');
  });

  it('shares again once lastSharedAt falls outside the window', async () => {
    await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());
    assert.equal(whatsappCalls.length, 1);

    // Backdate lastSharedAt past the 5-minute window.
    await app.service('prescriptions').patch(
      prescriptionId,
      { lastSharedAt: new Date(Date.now() - 10 * 60 * 1000) } as any
    );

    const second = await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());
    assert.ok(second.success);
    assert.ok(!second.deduplicated);
    assert.equal(whatsappCalls.length, 2);
  });

  it('records lastSharedAt after a successful send', async () => {
    const before = Date.now();
    await app.service('recetario').create({
      action: 'share',
      shareChannel: 'whatsapp',
      shareRecipient: '5492214567890',
      prescriptionId,
      pdfUrl: pdfServerUrl,
    } as any, internalParams());
    const updated = await app.service('prescriptions').get(prescriptionId) as any;
    assert.ok(updated.lastSharedAt, 'lastSharedAt should be set');
    assert.ok(new Date(updated.lastSharedAt).getTime() >= before);
  });
});
