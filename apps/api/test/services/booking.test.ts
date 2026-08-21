import assert from 'assert';
import type { Id } from '@feathersjs/feathers';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

const asPatient = (patientId: Id, organizationId: Id) => ({
  patient: { id: patientId, organizationId },
});

describe('\'booking\' service', function () {
  this.timeout(20000);

  let org: any;
  let medic: any;
  let patient: any;

  const createPatient = async (tag: string) => {
    const s = `${Date.now().toString(36)}-${tag}`;
    return app.service('patients').create({
      medicare: `BOOKING-${s}`,
      medicareNumber: `30001-${s}`,
    });
  };

  before(async () => {
    const suffix = Date.now().toString(36);
    org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.booking.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await createPatient('main');
  });

  it('registered the service', () => {
    assert.ok(app.service('booking'));
  });

  it('creates a booking with the unchanged response shape and a confirmed appointment', async () => {
    const startDate = new Date('2030-01-07T13:00:00Z').toISOString();
    const result = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;

    assert.deepStrictEqual(Object.keys(result).sort(), ['appointmentId', 'ok']);
    assert.strictEqual(result.ok, true);
    assert.ok(result.appointmentId);

    const appointment = await app.service('appointments').get(result.appointmentId, {
      provider: undefined,
    }) as any;
    assert.strictEqual(appointment.status, 'confirmed');
    assert.strictEqual(appointment.extra, false);
    assert.strictEqual(appointment.paidAt, null);
    assert.strictEqual(appointment.holdExpiresAt, null);
    assert.strictEqual(appointment.patientId, patient.id);
  });

  it('rejects booking an already taken slot', async () => {
    const startDate = new Date('2030-01-07T13:20:00Z').toISOString();
    await app.service('booking').create({ medicId: medic.id, startDate }, asPatient(patient.id, org.id));

    const other = await createPatient('taken');
    await assert.rejects(
      app.service('booking').create({ medicId: medic.id, startDate }, asPatient(other.id, org.id)),
      /already taken/
    );
  });

  it('rejects a slot taken through another organization', async () => {
    const suffix = Date.now().toString(36);
    const orgB = await createTestOrganization();
    await app.service('user-roles').create({
      userId: medic.id,
      organizationId: String(orgB.id),
      roleId: 'medic',
    });
    const patientB = await createPatient(`org-b-${suffix}`);

    const startDate = new Date('2030-01-07T13:40:00Z').toISOString();
    await app.service('booking').create({ medicId: medic.id, startDate }, asPatient(patient.id, org.id));

    await assert.rejects(
      app.service('booking').create({ medicId: medic.id, startDate }, asPatient(patientB.id, orgB.id)),
      /already taken/
    );
  });

  it('rejects a medic that does not belong to the organization', async () => {
    await assert.rejects(
      app.service('booking').create(
        { medicId: 'no-such-medic', startDate: new Date('2030-01-07T14:00:00Z').toISOString() },
        asPatient(patient.id, org.id)
      ),
      /Invalid medic/
    );
  });

  it('cancels an own future appointment and frees the slot for rebooking', async () => {
    const startDate = new Date('2030-01-08T13:00:00Z').toISOString();
    const created = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;

    const removed = await app.service('booking').remove(created.appointmentId, asPatient(patient.id, org.id)) as any;
    assert.strictEqual(removed.ok, true);

    const rebooked = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;
    assert.strictEqual(rebooked.ok, true);
  });

  it('does not cancel another patient\'s appointment', async () => {
    const startDate = new Date('2030-01-08T14:00:00Z').toISOString();
    const created = await app.service('booking').create(
      { medicId: medic.id, startDate },
      asPatient(patient.id, org.id)
    ) as any;

    const other = await createPatient('foreign');
    await assert.rejects(
      app.service('booking').remove(created.appointmentId, asPatient(other.id, org.id)),
      /not found/
    );
  });

  it('lists own bookings with their status', async () => {
    const bookings = await app.service('booking').find({
      query: { intent: 'find-bookings' },
      ...asPatient(patient.id, org.id),
    }) as any[];

    assert.ok(bookings.length > 0);
    for (const booking of bookings) {
      assert.strictEqual(booking.status, 'confirmed');
      assert.ok(booking.medic);
    }
  });
});
