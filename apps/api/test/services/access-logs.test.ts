import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'access-logs\' service', () => {
  let org: any;
  let user: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization();
    user = await createTestUser({
      username: `test.access.logs.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      medicare: `ACCESS_LOG_TEST_${Date.now()}`,
      medicareNumber: '99887766',
    });
  });

  it('registered the service', () => {
    const service = app.service('access-logs');
    assert.ok(service, 'Registered the service');
  });

  it('creates an access log entry', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: '127.0.0.1',
    });

    assert.ok(log.id, 'Log entry has an ID');
    assert.strictEqual(log.userId, user.id);
    assert.strictEqual(log.organizationId, org.id);
    assert.strictEqual(log.resource, 'encounters');
    assert.strictEqual(log.patientId, patient.id);
    assert.strictEqual(log.action, 'read');
    assert.strictEqual(log.ip, '127.0.0.1');
    assert.ok(log.createdAt, 'Has createdAt timestamp');
  });

  it('creates a write log with metadata for delegated prescription', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'prescriptions',
      patientId: patient.id,
      action: 'write',
      ip: '192.168.1.1',
      metadata: { onBehalfOfMedicId: 'some-medic-id' },
    });

    assert.ok(log.id, 'Log entry has an ID');
    assert.strictEqual(log.action, 'write');
    assert.deepStrictEqual(log.metadata, { onBehalfOfMedicId: 'some-medic-id' });
  });

  it('creates an export log', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'export',
      ip: null,
    });

    assert.ok(log.id);
    assert.strictEqual(log.action, 'export');
  });

  it('stores client info metadata (browser, OS, user agent)', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'studies',
      patientId: patient.id,
      action: 'read',
      ip: '10.0.0.1',
      metadata: {
        browser: 'Chrome 122.0.0.0',
        os: 'Mac OS 14.3.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });

    assert.ok(log.id);
    assert.strictEqual(log.metadata.browser, 'Chrome 122.0.0.0');
    assert.strictEqual(log.metadata.os, 'Mac OS 14.3.1');
    assert.ok(log.metadata.userAgent);
  });

  it('finds logs by userId', async () => {
    const results = await app.service('access-logs').find({
      query: { userId: user.id },
      paginate: false,
    } as any) as any[];

    assert.ok(results.length >= 3, 'Found the created log entries');
  });

  it('finds logs by resource and patientId', async () => {
    const results = await app.service('access-logs').find({
      query: { resource: 'encounters', patientId: patient.id },
      paginate: false,
    } as any) as any[];

    assert.ok(results.length >= 2, 'Found encounter log entries');
  });
});
