import assert from 'assert';
import app from '../../src/app';

describe('\'time-off-events\' service', () => {
  let medic: any;
  const svc = app.service('time-off-events') as any;

  before(async () => {
    medic = await app.service('users').create({
      username: 'timeoff.medic',
      password: 'supersecret',
      roleId: 'medic'
    });
  });

  it('registered the service', () => {
    assert.ok(svc, 'Registered the service');
  });

  it('creates a valid time-off event', async () => {
    const event = await svc.create({
      medicId: medic.id,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      type: 'vacation',
      notes: 'Spring break'
    });

    assert.ok(event.id, 'Event has an ID');
    assert.strictEqual(event.type, 'vacation');
    assert.strictEqual(event.notes, 'Spring break');
    assert.strictEqual(event.medicId, medic.id);
  });

  it('rejects missing dates', async () => {
    try {
      await svc.create({
        medicId: medic.id,
        type: 'vacation'
      });
      assert.fail('Should require dates');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
      assert.ok(error.message.includes('startDate') || error.message.includes('endDate'));
    }
  });

  it('rejects invalid type', async () => {
    try {
      await svc.create({
        medicId: medic.id,
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        type: 'invalidType'
      });
      assert.fail('Should reject invalid type');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
      assert.ok(error.message.includes('type'));
    }
  });

  it('rejects startDate after endDate', async () => {
    try {
      await svc.create({
        medicId: medic.id,
        startDate: '2026-05-10',
        endDate: '2026-05-01',
        type: 'vacation'
      });
      assert.fail('Should reject inverted dates');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
      assert.ok(error.message.includes('startDate'));
    }
  });

  it('accepts all valid types', async () => {
    for (const type of ['vacation', 'cancelDay', 'other']) {
      const event = await svc.create({
        medicId: medic.id,
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        type
      });
      assert.strictEqual(event.type, type);
    }
  });

  it('normalizes dates to start/end of day', async () => {
    const event = await svc.create({
      medicId: medic.id,
      startDate: '2026-07-15T14:30:00Z',
      endDate: '2026-07-17T10:00:00Z',
      type: 'vacation'
    });

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    assert.strictEqual(start.getHours(), 0, 'startDate normalized to start of day (local)');
    assert.strictEqual(start.getMinutes(), 0);
    assert.strictEqual(end.getHours(), 23, 'endDate normalized to end of day (local)');
    assert.strictEqual(end.getMinutes(), 59);
  });

  it('validates on patch as well', async () => {
    const event = await svc.create({
      medicId: medic.id,
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      type: 'vacation'
    });

    try {
      await svc.patch(event.id, { type: 'badType' });
      assert.fail('Should reject invalid type on patch');
    } catch (error: any) {
      assert.strictEqual(error.name, 'BadRequest');
    }
  });
});
