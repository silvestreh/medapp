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
      password: 'SuperSecret1!',
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

  // --- New tests for purpose, refesId, hash chain ---

  it('defaults purpose to treatment', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: '127.0.0.1',
    });

    assert.strictEqual(log.purpose, 'treatment');
  });

  it('accepts explicit purpose values', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      purpose: 'emergency',
      ip: '127.0.0.1',
    });

    assert.strictEqual(log.purpose, 'emergency');
  });

  it('accepts shared-access resource with grant action', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'shared-access',
      patientId: patient.id,
      action: 'grant',
      purpose: 'share',
      ip: null,
      metadata: { grantedMedicId: 'some-other-medic-id' },
    });

    assert.ok(log.id);
    assert.strictEqual(log.resource, 'shared-access');
    assert.strictEqual(log.action, 'grant');
    assert.strictEqual(log.purpose, 'share');
    assert.strictEqual(log.metadata.grantedMedicId, 'some-other-medic-id');
  });

  it('allows null patientId for non-patient events', async () => {
    const log: any = await app.service('access-logs').create({
      userId: user.id,
      organizationId: org.id,
      resource: 'encounters',
      patientId: null,
      action: 'read',
      ip: null,
    });

    assert.ok(log.id);
    assert.strictEqual(log.patientId, null);
  });

  describe('hash chain', () => {
    let chainOrg: any;
    let chainUser: any;
    let chainPatient: any;

    before(async () => {
      chainOrg = await createTestOrganization();
      chainUser = await createTestUser({
        username: `test.chain.${Date.now()}`,
        password: 'SuperSecret1!',
        roleIds: ['medic'],
        organizationId: chainOrg.id,
      });
      chainPatient = await app.service('patients').create({
        medicare: `CHAIN_TEST_${Date.now()}`,
        medicareNumber: '11223344',
      });
    });

    it('computes hash and previousLogId on creation', async () => {
      const log1: any = await app.service('access-logs').create({
        userId: chainUser.id,
        organizationId: chainOrg.id,
        resource: 'encounters',
        patientId: chainPatient.id,
        action: 'read',
        ip: null,
      });

      assert.ok(log1.hash, 'First log has a hash');
      assert.strictEqual(log1.hash.length, 64, 'Hash is SHA-256 hex (64 chars)');
      assert.strictEqual(log1.previousLogId, null, 'First log has no previous');

      const log2: any = await app.service('access-logs').create({
        userId: chainUser.id,
        organizationId: chainOrg.id,
        resource: 'studies',
        patientId: chainPatient.id,
        action: 'read',
        ip: null,
      });

      assert.ok(log2.hash, 'Second log has a hash');
      assert.strictEqual(log2.previousLogId, log1.id, 'Second log chains to first');
      assert.notStrictEqual(log2.hash, log1.hash, 'Hashes are different');

      const log3: any = await app.service('access-logs').create({
        userId: chainUser.id,
        organizationId: chainOrg.id,
        resource: 'prescriptions',
        patientId: chainPatient.id,
        action: 'write',
        ip: null,
      });

      assert.ok(log3.hash, 'Third log has a hash');
      assert.strictEqual(log3.previousLogId, log2.id, 'Third log chains to second');
    });

    it('chains are independent per organization', async () => {
      const otherOrg = await createTestOrganization();
      const otherUser = await createTestUser({
        username: `test.chain.other.${Date.now()}`,
        password: 'SuperSecret1!',
        roleIds: ['medic'],
        organizationId: otherOrg.id,
      });

      const logOther: any = await app.service('access-logs').create({
        userId: otherUser.id,
        organizationId: otherOrg.id,
        resource: 'encounters',
        patientId: chainPatient.id,
        action: 'read',
        ip: null,
      });

      // First log in a different org should have no previousLogId
      assert.ok(logOther.hash, 'Has a hash');
      assert.strictEqual(logOther.previousLogId, null, 'No previous in this org chain');
    });

    it('skips hash chain for logs without organizationId', async () => {
      const log: any = await app.service('access-logs').create({
        userId: chainUser.id,
        organizationId: null,
        resource: 'encounters',
        patientId: chainPatient.id,
        action: 'read',
        ip: null,
      });

      assert.strictEqual(log.hash, null, 'No hash for org-less logs');
      assert.strictEqual(log.previousLogId, null, 'No chain for org-less logs');
    });
  });

  describe('refesId population', () => {
    it('populates refesId from organization settings', async () => {
      const refesOrg = await createTestOrganization();
      // Set refesId in settings via internal update
      await app.service('organizations').patch(refesOrg.id, {
        settings: { refesId: 'GOV-12345' },
      } as any);

      const refesUser = await createTestUser({
        username: `test.refes.${Date.now()}`,
        password: 'SuperSecret1!',
        roleIds: ['medic'],
        organizationId: refesOrg.id,
      });

      const log: any = await app.service('access-logs').create({
        userId: refesUser.id,
        organizationId: refesOrg.id,
        resource: 'encounters',
        patientId: patient.id,
        action: 'read',
        ip: null,
      });

      assert.strictEqual(log.refesId, 'GOV-12345');
    });

    it('leaves refesId null when org has no refesId in settings', async () => {
      const log: any = await app.service('access-logs').create({
        userId: user.id,
        organizationId: org.id,
        resource: 'encounters',
        patientId: patient.id,
        action: 'read',
        ip: null,
      });

      assert.strictEqual(log.refesId, null);
    });
  });
});
