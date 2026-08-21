import assert from 'assert';
import { QueryTypes, Sequelize } from 'sequelize';
import type { Id } from '@feathersjs/feathers';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

const asPatient = (patientId: Id, organizationId: Id) => ({
  patient: { id: patientId, organizationId },
});

describe('\'booking\' concurrent creation', function () {
  this.timeout(20000);

  let org: any;
  let medic: any;

  const createPatient = async (tag: string) => {
    const s = `${Date.now().toString(36)}-${tag}`;
    return app.service('patients').create({
      medicare: `BOOKING-CONC-${s}`,
      medicareNumber: `40001-${s}`,
    });
  };

  before(async () => {
    const suffix = Date.now().toString(36);
    org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.booking.conc.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  it('allows exactly one of several concurrent bookings for the same slot', async () => {
    const COUNT = 5;
    const startDate = new Date('2030-02-03T14:00:00Z').toISOString();
    const patients = await Promise.all(
      Array.from({ length: COUNT }, (_, i) => createPatient(`race-${i}`))
    );

    const results = await Promise.allSettled(
      patients.map((patient) =>
        app.service('booking').create({ medicId: medic.id, startDate }, asPatient(patient.id, org.id))
      )
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];

    assert.strictEqual(fulfilled.length, 1, 'exactly one booking should win the slot');
    assert.strictEqual(rejected.length, COUNT - 1);
    for (const result of rejected) {
      assert.match(result.reason.message, /already taken/);
    }

    const rows = await app.service('appointments').find({
      query: { medicId: medic.id, startDate },
      provider: undefined,
      paginate: false,
    }) as any[];
    assert.strictEqual(rows.length, 1, 'exactly one appointment row should exist for the slot');
  });

  it('books concurrent DIFFERENT slots without interference', async () => {
    const COUNT = 4;
    const patients = await Promise.all(
      Array.from({ length: COUNT }, (_, i) => createPatient(`distinct-${i}`))
    );

    const results = await Promise.all(
      patients.map((patient, i) =>
        app.service('booking').create(
          { medicId: medic.id, startDate: new Date(`2030-02-04T1${i}:00:00Z`).toISOString() },
          asPatient(patient.id, org.id)
        )
      )
    ) as any[];

    assert.strictEqual(results.length, COUNT);
    const ids = new Set(results.map((result) => result.appointmentId));
    assert.strictEqual(ids.size, COUNT);
  });

  it('releases the lock after a failed booking so the slot can be rebooked', async () => {
    const startDate = new Date('2030-02-05T10:00:00Z').toISOString();
    const winner = await createPatient('winner');
    const loser = await createPatient('loser');

    await app.service('booking').create({ medicId: medic.id, startDate }, asPatient(winner.id, org.id));
    await assert.rejects(
      app.service('booking').create({ medicId: medic.id, startDate }, asPatient(loser.id, org.id)),
      /already taken/
    );

    // The failed create must have rolled back and released its advisory lock:
    // a booking on a different slot must go through immediately.
    const other = await app.service('booking').create(
      { medicId: medic.id, startDate: new Date('2030-02-05T10:20:00Z').toISOString() },
      asPatient(loser.id, org.id)
    ) as any;
    assert.strictEqual(other.ok, true);
  });

  it('leaves no advisory locks held after bookings', async () => {
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
});
