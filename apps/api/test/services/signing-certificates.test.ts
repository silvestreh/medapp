import assert from 'assert';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';

const CERT_PATH = path.join(__dirname, '../fixtures/test-certificate.p12');

describe('\'signing-certificates\' service', () => {
  let medic: any;
  let p12Buffer: Buffer;

  before(async () => {
    p12Buffer = fs.readFileSync(CERT_PATH);

    medic = await app.service('users').create({
      username: 'cert.test.medic',
      password: 'supersecret',
      roleId: 'medic',
    });
  });

  it('registered the service', () => {
    const service = app.service('signing-certificates');
    assert.ok(service, 'Registered the service');
  });

  it('uploads a .p12 certificate', async () => {
    const result: any = await app.service('signing-certificates').create(
      { userId: medic.id } as any,
      {
        file: {
          originalname: 'test-certificate.p12',
          buffer: p12Buffer,
        },
      } as any
    );

    assert.ok(result.id, 'Certificate has an id');
    assert.strictEqual(result.userId, medic.id);
    assert.strictEqual(result.fileName, 'test-certificate.p12');
  });

  it('find returns certificate for the user (internal call includes certificate data)', async () => {
    const results = await app.service('signing-certificates').find({
      query: { userId: medic.id },
      paginate: false,
    } as any) as any[];

    assert.strictEqual(results.length, 1, 'One certificate found');
    assert.strictEqual(results[0].userId, medic.id);
    assert.ok(results[0].certificate, 'Certificate data is present for internal calls');
    assert.strictEqual(results[0].fileName, 'test-certificate.p12');
  });

  it('find strips certificate data for external calls', async () => {
    const results = await app.service('signing-certificates').find({
      query: { userId: medic.id },
      provider: 'rest',
      user: medic,
      authenticated: true,
    } as any);

    const items = (results as any).data || results;
    const certs = Array.isArray(items) ? items : [];
    assert.strictEqual(certs.length, 1, 'One certificate found');
    assert.ok(!certs[0].certificate, 'Certificate data is stripped for external calls');
    assert.ok(certs[0].fileName, 'File name is still present');
  });

  it('replaces existing certificate when uploading a new one', async () => {
    const result: any = await app.service('signing-certificates').create(
      { userId: medic.id } as any,
      {
        file: {
          originalname: 'replacement-certificate.p12',
          buffer: p12Buffer,
        },
      } as any
    );

    assert.ok(result.id, 'New certificate has an id');
    assert.strictEqual(result.fileName, 'replacement-certificate.p12');

    const all = await app.service('signing-certificates').find({
      query: { userId: medic.id },
      paginate: false,
    } as any) as any[];

    assert.strictEqual(all.length, 1, 'Only one certificate exists after replacement');
  });

  it('removes a certificate', async () => {
    const before = await app.service('signing-certificates').find({
      query: { userId: medic.id },
      paginate: false,
    } as any) as any[];

    assert.strictEqual(before.length, 1, 'Certificate exists before removal');

    await app.service('signing-certificates').remove(before[0].id);

    const after = await app.service('signing-certificates').find({
      query: { userId: medic.id },
      paginate: false,
    } as any) as any[];

    assert.strictEqual(after.length, 0, 'No certificates after removal');
  });
});
