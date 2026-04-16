import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'practice-codes\' service', () => {
  let org: any;
  let medic: any;
  let prescriber: any;
  let receptionist: any;
  let practice: any;
  let prepaga: any;
  let prepaga2: any;

  before(async () => {
    app.setup();
    await app.get('sequelizeSync');

    // Seed roles (idempotent)
    await app.service('roles').create({
      id: 'medic',
      permissions: ['*'],
    }).catch(() => null);
    await app.service('roles').create({
      id: 'prescriber',
      permissions: ['practice-codes:create', 'practice-codes:find', 'practice-codes:patch', 'practice-codes:remove'],
    }).catch(() => null);
    await app.service('roles').create({
      id: 'receptionist',
      permissions: [],
    }).catch(() => null);

    org = await createTestOrganization({ name: 'Practice Codes Test Org' });

    medic = await createTestUser({
      username: `test.medic.pc.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    prescriber = await createTestUser({
      username: `test.prescriber.pc.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['prescriber'],
      organizationId: org.id,
    });

    receptionist = await createTestUser({
      username: `test.receptionist.pc.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['receptionist'],
      organizationId: org.id,
    });

    // Create a delegation: medic delegates to prescriber
    await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    practice = await app.service('practices').create({
      title: 'Test Practice for Codes',
      description: 'Used in practice-codes tests',
      organizationId: org.id,
    });

    prepaga = await app.service('prepagas').create({
      denomination: 'Test Insurer for Codes',
      shortName: `TIC-${Date.now()}`,
      tiers: [],
    });

    prepaga2 = await app.service('prepagas').create({
      denomination: 'Second Test Insurer',
      shortName: `TIC2-${Date.now()}`,
      tiers: [],
    });
  });

  it('registered the service', () => {
    const service = app.service('practice-codes');
    assert.ok(service, 'Registered the service');
  });

  it('allows a medic to create their own practice code', async () => {
    const code: any = await app.service('practice-codes').create(
      {
        practiceId: practice.id,
        insurerId: prepaga.id,
        code: 'MED001',
      },
      {
        provider: 'rest',
        user: medic,
        authenticated: true,
        organizationId: org.id,
      }
    );

    assert.ok(code.id);
    assert.strictEqual(code.userId, medic.id);
    assert.strictEqual(code.practiceId, practice.id);
    assert.strictEqual(code.insurerId, prepaga.id);
    assert.strictEqual(code.code, 'MED001');
  });

  it('allows a prescriber with delegation to create a code for the medic', async () => {
    const code: any = await app.service('practice-codes').create(
      {
        practiceId: practice.id,
        insurerId: prepaga2.id,
        code: 'PRE001',
        userId: medic.id,
      },
      {
        provider: 'rest',
        user: prescriber,
        authenticated: true,
        organizationId: org.id,
      }
    );

    assert.ok(code.id);
    assert.strictEqual(code.userId, medic.id, 'userId should be the medic, not the prescriber');
    assert.strictEqual(code.code, 'PRE001');
  });

  it('rejects when prescriber creates a code without userId (defaults to non-medic)', async () => {
    try {
      await app.service('practice-codes').create(
        {
          practiceId: practice.id,
          insurerId: prepaga.id,
          code: 'FAIL001',
        },
        {
          provider: 'rest',
          user: prescriber,
          authenticated: true,
          organizationId: org.id,
        }
      );
      assert.fail('Should have thrown — prescriber is not a medic');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
    }
  });

  it('rejects when userId points to a non-medic user', async () => {
    try {
      await app.service('practice-codes').create(
        {
          practiceId: practice.id,
          insurerId: prepaga.id,
          code: 'FAIL002',
          userId: receptionist.id,
        },
        {
          provider: 'rest',
          user: medic,
          authenticated: true,
          organizationId: org.id,
        }
      );
      assert.fail('Should have thrown — receptionist is not a medic');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
    }
  });

  it('scopes find to the authenticated user by default', async () => {
    const results: any = await app.service('practice-codes').find({
      provider: 'rest',
      user: medic,
      authenticated: true,
      organizationId: org.id,
      query: {},
      paginate: false,
    });

    const codes = Array.isArray(results) ? results : results.data;
    assert.ok(codes.length > 0, 'Medic should have codes');
    assert.ok(codes.every((c: any) => c.userId === medic.id), 'All codes should belong to the medic');
  });

  it('allows prescriber with delegation to find codes for the medic', async () => {
    const results: any = await app.service('practice-codes').find({
      provider: 'rest',
      user: prescriber,
      authenticated: true,
      organizationId: org.id,
      query: { userId: medic.id },
      paginate: false,
    });

    const codes = Array.isArray(results) ? results : results.data;
    assert.ok(codes.length > 0, 'Should find medic codes via delegation');
    assert.ok(codes.every((c: any) => c.userId === medic.id));
  });
});
