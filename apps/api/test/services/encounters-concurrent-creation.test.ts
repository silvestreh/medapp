import assert from 'assert';
import { QueryTypes, Sequelize } from 'sequelize';
import type { Id } from '@feathersjs/feathers';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'encounters\' concurrent creation', function () {
  this.timeout(20000);

  let medic: any;

  const createPatient = async (tag: string) => {
    const s = `${Date.now().toString(36)}-${tag}`;
    return app.service('patients').create({
      medicare: `CONCURRENT-${s}`,
      medicareNumber: `20001-${s}`
    });
  };

  const verifyChain = async (patientId: Id) => {
    return app.service('encounter-chain-verification').find({
      query: { patientId },
      provider: undefined,
    }) as any;
  };

  before(async () => {
    const suffix = Date.now().toString(36);
    const org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.concurrent.enc.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  it('creates concurrent encounters for one patient with a valid hash chain', async () => {
    const patient = await createPatient('single');
    const COUNT = 10;
    const date = new Date('2025-03-01T10:00:00Z');

    const created = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        app.service('encounters').create({
          data: { notes: { values: { text: `Concurrent ${i}` } } },
          date,
          medicId: medic.id,
          patientId: patient.id,
        })
      )
    ) as any[];

    assert.strictEqual(created.length, COUNT, 'every concurrent create should succeed');

    const ids = new Set(created.map((encounter) => encounter.id));
    assert.strictEqual(ids.size, COUNT, 'every encounter should get a distinct id');

    // Serialized creation must produce one linked list: each encounter points
    // at the previous one in (date, id) order, starting from null.
    const sorted = [...created].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    assert.strictEqual(sorted[0].previousEncounterId, null);
    for (let i = 1; i < sorted.length; i++) {
      assert.strictEqual(
        sorted[i].previousEncounterId,
        sorted[i - 1].id,
        `encounter at position ${i} should link to its predecessor`
      );
    }

    const result = await verifyChain(patient.id);
    assert.strictEqual(result.valid, true, `chain broken at ${JSON.stringify(result.brokenAt)}`);
    assert.strictEqual(result.totalEncounters, COUNT);
    assert.strictEqual(result.verified, COUNT);
  });

  it('creates concurrent encounters across several patients with valid chains', async () => {
    const PATIENTS = 3;
    const PER_PATIENT = 4;
    const date = new Date('2025-04-01T10:00:00Z');

    const patients = await Promise.all(
      Array.from({ length: PATIENTS }, (_, i) => createPatient(`multi-${i}`))
    );

    const creates: Promise<any>[] = [];
    for (const patient of patients) {
      for (let i = 0; i < PER_PATIENT; i++) {
        creates.push(app.service('encounters').create({
          data: { notes: { values: { text: `Multi ${i}` } } },
          date,
          medicId: medic.id,
          patientId: patient.id,
        }) as Promise<any>);
      }
    }
    const created = await Promise.all(creates);

    assert.strictEqual(created.length, PATIENTS * PER_PATIENT);

    for (const patient of patients) {
      const result = await verifyChain(patient.id);
      assert.strictEqual(
        result.valid,
        true,
        `chain for patient ${patient.id} broken at ${JSON.stringify(result.brokenAt)}`
      );
      assert.strictEqual(result.totalEncounters, PER_PATIENT);
      assert.strictEqual(result.verified, PER_PATIENT);
    }
  });

  it('leaves no advisory locks held after creation', async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');

    const locks = await sequelize.query(
      'SELECT * FROM pg_locks WHERE locktype = \'advisory\'',
      { type: QueryTypes.SELECT }
    );

    assert.strictEqual(
      locks.length,
      0,
      `expected no advisory locks to remain, found ${locks.length}`
    );
  });

  it('rolls back and releases the lock when creation fails', async () => {
    const patient = await createPatient('rollback');
    const date = new Date('2025-05-01T10:00:00Z');

    await assert.rejects(
      app.service('encounters').create({
        data: { notes: { values: { text: 'Bad medic' } } },
        date,
        medicId: 'non-existent-medic-id',
        patientId: patient.id,
      })
    );

    // The failed create must not leave its advisory lock behind: a subsequent
    // create for the same patient would otherwise block forever.
    const encounter = await app.service('encounters').create({
      data: { notes: { values: { text: 'After failure' } } },
      date,
      medicId: medic.id,
      patientId: patient.id,
    }) as any;

    assert.ok(encounter.id);

    const result = await verifyChain(patient.id);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEncounters, 1);
  });
});
