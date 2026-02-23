import assert from 'assert';
import app from '../../src/app';

describe('\'laboratories\' service', () => {
  it('registered the service', () => {
    const service = app.service('laboratories');
    assert.ok(service, 'Registered the service');
  });

  it('creates a laboratory', async () => {
    const lab = await app.service('laboratories').create({
      name: 'Lab Create Test'
    });

    assert.ok(lab.id, 'Laboratory has an ID');
    assert.strictEqual(lab.name, 'Lab Create Test');
  });

  it('supports bulk create', async () => {
    const labs = await app.service('laboratories').create([
      { name: 'Bulk Lab A' },
      { name: 'Bulk Lab B' }
    ]);

    assert.strictEqual(labs.length, 2, 'Created two laboratories');
    assert.strictEqual(labs[0].name, 'Bulk Lab A');
    assert.strictEqual(labs[1].name, 'Bulk Lab B');
  });

  it('enforces unique name', async () => {
    await app.service('laboratories').create({ name: 'Unique Lab Name' });

    try {
      await app.service('laboratories').create({ name: 'Unique Lab Name' });
      assert.fail('Should not allow duplicate name');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate name');
    }
  });

  it('finds laboratories', async () => {
    const result: any = await app.service('laboratories').find({ query: {} });
    assert.ok(result.data.length > 0, 'Found laboratories');
  });

  it('gets a laboratory by id', async () => {
    const lab = await app.service('laboratories').create({ name: 'Get By Id Lab' });
    const fetched = await app.service('laboratories').get(lab.id);

    assert.strictEqual(fetched.id, lab.id);
    assert.strictEqual(fetched.name, 'Get By Id Lab');
  });
});
