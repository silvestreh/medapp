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
  });
});
