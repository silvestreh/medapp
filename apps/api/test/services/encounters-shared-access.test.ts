import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { getUserPermissions } from '../../src/utils/get-user-permissions';
import type { SharedEncounterAccess } from '../../src/declarations';

async function createGrant(data: Omit<SharedEncounterAccess, 'id'>): Promise<SharedEncounterAccess> {
  return app.service('shared-encounter-access').create(data) as Promise<SharedEncounterAccess>;
}

describe('encounters shared access', () => {
  let org: any;
  let medicA: any;
  let medicB: any;
  let patient: any;
  let patientOther: any;
  let encounterA1: any;
  let encounterA2: any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let encounterAOther: any;
  let encounterB1: any;

  before(async () => {
    org = await createTestOrganization();

    medicA = await createTestUser({
      username: `test.shared.enc.a.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    medicB = await createTestUser({
      username: `test.shared.enc.b.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      medicare: `SHARED_ENC_${Date.now()}`,
      medicareNumber: '11223344'
    });

    patientOther = await app.service('patients').create({
      medicare: `SHARED_ENC_OTHER_${Date.now()}`,
      medicareNumber: '55667788'
    });

    // Create encounters as Medic A for patient
    encounterA1 = await app.service('encounters').create({
      data: { clinicalNotes: { values: { notes: 'Encounter A1' } } },
      date: new Date(),
      medicId: medicA.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    encounterA2 = await app.service('encounters').create({
      data: { clinicalNotes: { values: { notes: 'Encounter A2' } } },
      date: new Date(),
      medicId: medicA.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    // Create encounter as Medic A for a different patient
    encounterAOther = await app.service('encounters').create({
      data: { clinicalNotes: { values: { notes: 'Encounter A Other Patient' } } },
      date: new Date(),
      medicId: medicA.id,
      patientId: patientOther.id,
      organizationId: org.id,
    });

    // Create encounter as Medic B
    encounterB1 = await app.service('encounters').create({
      data: { clinicalNotes: { values: { notes: 'Encounter B1' } } },
      date: new Date(),
      medicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });
  });

  it('medic B cannot see medic A encounters without a grant', async () => {
    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const results = await app.service('encounters').find({
      query: { patientId: patient.id },
      provider: 'rest',
      user: medicB,
      organizationId: org.id,
      orgPermissions,
      paginate: false,
    } as any) as any[];

    const medicAEncounterIds = results
      .filter((e: any) => e.medicId === medicA.id)
      .map((e: any) => e.id);

    assert.strictEqual(
      medicAEncounterIds.length, 0,
      'Medic B should not see any of Medic A encounters'
    );
  });

  it('medic B can see medic A encounters after a grant is created', async () => {
    const grant = await createGrant({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const results = await app.service('encounters').find({
      query: { patientId: patient.id },
      provider: 'rest',
      user: medicB,
      organizationId: org.id,
      orgPermissions,
      paginate: false,
    } as any) as any[];

    const medicAEncounterIds = results
      .filter((e: any) => e.medicId === medicA.id)
      .map((e: any) => e.id);

    assert.ok(
      medicAEncounterIds.includes(encounterA1.id),
      'Medic B should see encounter A1'
    );
    assert.ok(
      medicAEncounterIds.includes(encounterA2.id),
      'Medic B should see encounter A2'
    );

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('grant for patient X does not give access to patient Y encounters', async () => {
    const grant = await createGrant({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const results = await app.service('encounters').find({
      query: { patientId: patientOther.id },
      provider: 'rest',
      user: medicB,
      organizationId: org.id,
      orgPermissions,
      paginate: false,
    } as any) as any[];

    const medicAEncounterIds = results
      .filter((e: any) => e.medicId === medicA.id)
      .map((e: any) => e.id);

    assert.strictEqual(
      medicAEncounterIds.length, 0,
      'Grant for patient X should not give access to patient Y encounters'
    );

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('shared encounters are marked as readOnly', async () => {
    const grant = await createGrant({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const results = await app.service('encounters').find({
      query: { patientId: patient.id },
      provider: 'rest',
      user: medicB,
      organizationId: org.id,
      orgPermissions,
      paginate: false,
    } as any) as any[];

    const sharedEncounters = results.filter((e: any) => e.medicId === medicA.id);
    const ownEncounters = results.filter((e: any) => e.medicId === medicB.id);

    for (const enc of sharedEncounters) {
      assert.strictEqual(enc.readOnly, true, 'Shared encounter should be readOnly');
      assert.strictEqual(enc.sharedBy, medicA.id, 'Shared encounter should have sharedBy');
    }

    for (const enc of ownEncounters) {
      assert.strictEqual(enc.readOnly, undefined, 'Own encounter should not be readOnly');
      assert.strictEqual(enc.sharedBy, undefined, 'Own encounter should not have sharedBy');
    }

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('medic B can get a specific shared encounter', async () => {
    const grant = await createGrant({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const encounter = await app.service('encounters').get(encounterA1.id, {
      provider: 'rest',
      user: medicB,
      organizationId: org.id,
      orgPermissions,
    } as any);

    assert.ok(encounter, 'Medic B can get a shared encounter');
    assert.strictEqual(encounter.id, encounterA1.id);

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('revoking a grant removes access', async () => {
    const grant = await createGrant({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    await app.service('shared-encounter-access').remove(grant.id);

    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    try {
      await app.service('encounters').get(encounterA1.id, {
        provider: 'rest',
        user: medicB,
        organizationId: org.id,
        orgPermissions,
      } as any);
      assert.fail('Should have thrown Forbidden');
    } catch (error: any) {
      assert.strictEqual(error.code, 403, 'Should be a Forbidden error');
    }
  });

  it('medic B own encounters still work normally', async () => {
    const orgPermissions = await getUserPermissions(app, medicB.id, org.id);

    const results = await app.service('encounters').find({
      query: { patientId: patient.id },
      provider: 'rest',
      user: medicB,
      organizationId: org.id,
      orgPermissions,
      paginate: false,
    } as any) as any[];

    const ownEncounters = results.filter((e: any) => e.medicId === medicB.id);
    assert.ok(
      ownEncounters.some((e: any) => e.id === encounterB1.id),
      'Medic B should still see their own encounters'
    );
  });
});
