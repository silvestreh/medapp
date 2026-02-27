import assert from 'assert';
import app from '../../src/app';

describe('\'md-settings\' service', () => {
  let user: any;

  before(async () => {
    user = await app.service('users').create({
      username: 'test.medic.md.settings.accounting',
      password: 'SuperSecret1',
      roleId: 'medic'
    });
  });

  it('registered the service', () => {
    const service = app.service('md-settings');

    assert.ok(service, 'Registered the service');
  });

  it('creates settings with schedule fields', async () => {
    const service = app.service('md-settings');

    const created = await service.create({
      userId: user.id,
      encounterDuration: 30,
      mondayStart: '08:00',
      mondayEnd: '17:00',
    } as any);

    assert.strictEqual(created.encounterDuration, 30);
    assert.strictEqual((created as any).mondayStart, '08:00:00');
    assert.strictEqual((created as any).mondayEnd, '17:00:00');
  });

  it('patches schedule fields', async () => {
    const service = app.service('md-settings');
    const created = await service.create({
      userId: user.id,
      encounterDuration: 20,
    } as any);

    const patched = await service.patch(created.id, {
      encounterDuration: 45,
      tuesdayStart: '09:00',
      tuesdayEnd: '18:00',
    } as any);

    assert.strictEqual(patched.encounterDuration, 45);
    assert.strictEqual((patched as any).tuesdayStart, '09:00:00');
    assert.strictEqual((patched as any).tuesdayEnd, '18:00:00');
  });
});
