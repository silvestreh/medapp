import assert from 'assert';
import app from '../../src/app';
import { getUserPermissions } from '../../src/utils/get-user-permissions';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('Break the Glass (BTG) emergency access', () => {
  let org: any;
  let medicA: any;
  let medicB: any;
  let accountant: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization();

    medicA = await createTestUser({
      username: `test.btg.medic.a.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    medicB = await createTestUser({
      username: `test.btg.medic.b.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    accountant = await createTestUser({
      username: `test.btg.accounting.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['accounting'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      medicare: `BTG_TEST_${Date.now()}`,
      medicareNumber: '44556677',
    });

    // Create encounters by medicA
    await app.service('encounters').create({
      data: { notes: { values: { text: 'MedicA encounter 1' } } },
      date: new Date('2025-03-01'),
      medicId: medicA.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'MedicA encounter 2' } } },
      date: new Date('2025-03-02'),
      medicId: medicA.id,
      patientId: patient.id,
      organizationId: org.id,
    });
  });

  it('medic can access all encounters with btg=true', async () => {
    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const results = await app.service('encounters').find({
      query: {
        patientId: patient.id,
        btg: true,
      },
      paginate: false,
      provider: 'rest',
      authenticated: true,
      user: medicB,
      organizationId: org.id,
      orgPermissions,
    } as any) as any[];

    assert.ok(Array.isArray(results), 'Returns an array');
    assert.ok(results.length >= 2, 'Can see all encounters for the patient');
  });

  it('BTG access creates a log with purpose=emergency', async () => {
    // Wait a moment for fire-and-forget log to be written
    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        userId: medicB.id,
        patientId: patient.id,
        purpose: 'emergency',
      },
      paginate: false,
    } as any) as any[];

    assert.ok(logs.length >= 1, 'Found at least one emergency access log');
    assert.strictEqual(logs[0].purpose, 'emergency');
  });

  it('non-medic role is rejected when using btg', async () => {
    const orgPermissions = await getUserPermissions(app, accountant.id, org.id);

    try {
      await app.service('encounters').find({
        query: {
          patientId: patient.id,
          btg: true,
        },
        paginate: false,
        provider: 'rest',
        authenticated: true,
        user: accountant,
        organizationId: org.id,
        orgPermissions,
      } as any);
      assert.fail('Should have thrown Forbidden');
    } catch (error: any) {
      assert.strictEqual(error.code, 403);
      assert.ok(error.message.includes('medic'));
    }
  });

  it('btg flag is stripped from query (does not affect DB query)', async () => {
    const orgPermissions = await getUserPermissions(app, medicA.id, org.id);

    const results = await app.service('encounters').find({
      query: {
        patientId: patient.id,
        btg: true,
      },
      paginate: false,
      provider: 'rest',
      authenticated: true,
      user: medicA,
      organizationId: org.id,
      orgPermissions,
    } as any) as any[];

    assert.ok(Array.isArray(results));
  });
});
