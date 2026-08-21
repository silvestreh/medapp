import assert from 'assert';
import app from '../../src/app';
import { Sequelize } from 'sequelize';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'access-log-chain-verification\' service', () => {
  let org: any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let user: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization();
    user = await createTestUser({
      username: `test.chain.verify.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      medicare: `CHAIN_VERIFY_${Date.now()}`,
      medicareNumber: '55667788',
    });
  });

  it('registered the service', () => {
    const service = app.service('access-log-chain-verification');
    assert.ok(service, 'Registered the service');
  });

  it('returns valid for an organization with no logs', async () => {
    const emptyOrg = await createTestOrganization();

    const result = await app.service('access-log-chain-verification').find({
      query: { organizationId: emptyOrg.id },
      provider: undefined,
      isSuperAdmin: true,
    }) as any;

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalLogs, 0);
  });

  it('returns valid for a valid chain', async () => {
    const chainOrg = await createTestOrganization();
    const chainUser = await createTestUser({
      username: `test.chain.valid.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: chainOrg.id,
    });

    await app.service('access-logs').create({
      userId: chainUser.id,
      organizationId: chainOrg.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    await app.service('access-logs').create({
      userId: chainUser.id,
      organizationId: chainOrg.id,
      resource: 'studies',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    await app.service('access-logs').create({
      userId: chainUser.id,
      organizationId: chainOrg.id,
      resource: 'prescriptions',
      patientId: patient.id,
      action: 'write',
      ip: null,
    });

    const result = await app.service('access-log-chain-verification').find({
      query: { organizationId: chainOrg.id },
      provider: undefined,
      isSuperAdmin: true,
    }) as any;

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalLogs, 3);
    assert.strictEqual(result.verified, 3);
  });

  it('detects a tampered log in the chain', async () => {
    const sequelizeClient: Sequelize = app.get('sequelizeClient');
    const tamperOrg = await createTestOrganization();
    const tamperUser = await createTestUser({
      username: `test.chain.tamper.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: tamperOrg.id,
    });

    await app.service('access-logs').create({
      userId: tamperUser.id,
      organizationId: tamperOrg.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    const log2: any = await app.service('access-logs').create({
      userId: tamperUser.id,
      organizationId: tamperOrg.id,
      resource: 'studies',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    await app.service('access-logs').create({
      userId: tamperUser.id,
      organizationId: tamperOrg.id,
      resource: 'prescriptions',
      patientId: patient.id,
      action: 'write',
      ip: null,
    });

    // Tamper with log2's action
    await sequelizeClient.query(
      'UPDATE access_logs SET action = :action WHERE id = :id',
      { replacements: { action: 'export', id: log2.id } }
    );

    const result = await app.service('access-log-chain-verification').find({
      query: { organizationId: tamperOrg.id },
      provider: undefined,
      isSuperAdmin: true,
    }) as any;

    assert.strictEqual(result.valid, false);
    assert.ok(result.brokenAt, 'Should report where the chain broke');
    assert.strictEqual(result.brokenAt.logId, log2.id);
    assert.strictEqual(result.brokenAt.position, 1);
    assert.strictEqual(result.brokenAt.reason, 'hash-mismatch');
  });

  it('stays valid when two logs share the same createdAt millisecond', async () => {
    const sequelizeClient: Sequelize = app.get('sequelizeClient');
    const tieOrg = await createTestOrganization();
    const tieUser = await createTestUser({
      username: `test.chain.tie.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: tieOrg.id,
    });

    // Explicit ids chosen so a (createdAt, id) sort inverts the true insertion
    // order once the timestamps tie — the exact case that used to read as a
    // broken chain
    const firstId = `zzzz-tie-${Date.now()}`;
    const secondId = `aaaa-tie-${Date.now()}`;

    const first: any = await app.service('access-logs').create({
      id: firstId,
      userId: tieUser.id,
      organizationId: tieOrg.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    const second: any = await app.service('access-logs').create({
      id: secondId,
      userId: tieUser.id,
      organizationId: tieOrg.id,
      resource: 'studies',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    assert.strictEqual(second.previousLogId, first.id);

    // Force the same-millisecond timestamps that fire-and-forget logging produces
    await sequelizeClient.query(
      `UPDATE access_logs
       SET "createdAt" = (SELECT "createdAt" FROM access_logs WHERE id = :firstId)
       WHERE id = :secondId`,
      { replacements: { firstId, secondId } }
    );

    const result = await app.service('access-log-chain-verification').find({
      query: { organizationId: tieOrg.id },
      provider: undefined,
      isSuperAdmin: true,
    }) as any;

    assert.strictEqual(result.valid, true, `chain broken at ${JSON.stringify(result.brokenAt)}`);
    assert.strictEqual(result.totalLogs, 2);
    assert.strictEqual(result.verified, 2);

    // The next log must chain onto the true tip (second), not whichever log
    // sorts last by (createdAt, id)
    const third: any = await app.service('access-logs').create({
      userId: tieUser.id,
      organizationId: tieOrg.id,
      resource: 'prescriptions',
      patientId: patient.id,
      action: 'write',
      ip: null,
    });

    assert.strictEqual(third.previousLogId, second.id);

    const finalResult = await app.service('access-log-chain-verification').find({
      query: { organizationId: tieOrg.id },
      provider: undefined,
      isSuperAdmin: true,
    }) as any;

    assert.strictEqual(finalResult.valid, true, `chain broken at ${JSON.stringify(finalResult.brokenAt)}`);
    assert.strictEqual(finalResult.totalLogs, 3);
    assert.strictEqual(finalResult.verified, 3);
  });

  it('detects a log whose previous link points outside the chain', async () => {
    const sequelizeClient: Sequelize = app.get('sequelizeClient');
    const orphanOrg = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const orphanUser = await createTestUser({
      username: `test.chain.orphan.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orphanOrg.id,
    });
    const otherUser = await createTestUser({
      username: `test.chain.other.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: otherOrg.id,
    });

    await app.service('access-logs').create({
      userId: orphanUser.id,
      organizationId: orphanOrg.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    const second: any = await app.service('access-logs').create({
      userId: orphanUser.id,
      organizationId: orphanOrg.id,
      resource: 'studies',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    const foreignLog: any = await app.service('access-logs').create({
      userId: otherUser.id,
      organizationId: otherOrg.id,
      resource: 'encounters',
      patientId: patient.id,
      action: 'read',
      ip: null,
    });

    // Re-link the second log to another organization's chain — the referenced
    // log exists in the table (FK holds) but is missing from this chain
    await sequelizeClient.query(
      'UPDATE access_logs SET "previousLogId" = :foreignId WHERE id = :id',
      { replacements: { foreignId: foreignLog.id, id: second.id } }
    );

    const result = await app.service('access-log-chain-verification').find({
      query: { organizationId: orphanOrg.id },
      provider: undefined,
      isSuperAdmin: true,
    }) as any;

    assert.strictEqual(result.valid, false);
    assert.ok(result.brokenAt, 'Should report where the chain broke');
    assert.strictEqual(result.brokenAt.logId, second.id);
    assert.strictEqual(result.brokenAt.reason, 'missing-previous-log');
  });
});
