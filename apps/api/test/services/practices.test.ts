import assert from 'assert';
import app from '../../src/app';
import { createTestOrganization } from '../test-helpers';

describe('\'practices\' service', () => {
  let org: any;

  before(async () => {
    await app.get('sequelizeSync');

    org = await createTestOrganization({ name: 'Practices Test Org' });
  });

  it('registered the service', () => {
    const service = app.service('practices');
    assert.ok(service, 'Registered the service');
  });

  it('seeds system practices on first find', async () => {
    const results = await app.service('practices').find({
      query: { organizationId: org.id },
      paginate: false,
    }) as any[];

    assert.strictEqual(results.length, 7, 'Should have 7 system practices');
    assert.ok(results.every((p: any) => p.isSystem), 'All should be system practices');

    const systemKeys = results.map((p: any) => p.systemKey).sort();
    assert.deepStrictEqual(systemKeys, [
      'anemia',
      'anticoagulation',
      'compatibility',
      'encounter',
      'hemostasis',
      'myelogram',
      'thrombophilia',
    ]);
  });

  it('does not duplicate system practices on subsequent find', async () => {
    const results = await app.service('practices').find({
      query: { organizationId: org.id },
      paginate: false,
    }) as any[];

    assert.strictEqual(results.length, 7, 'Still 7 practices');
  });

  it('creates a custom practice', async () => {
    const practice: any = await app.service('practices').create({
      title: 'Custom Practice',
      description: 'Test custom practice description',
      organizationId: org.id,
    });

    assert.ok(practice.id, 'Has an id');
    assert.strictEqual(practice.title, 'Custom Practice');
    assert.strictEqual(practice.description, 'Test custom practice description');
    assert.strictEqual(practice.isSystem, false);
    assert.strictEqual(practice.systemKey, null);
    assert.strictEqual(practice.organizationId, org.id);
  });

  it('prevents creating practices with isSystem=true', async () => {
    try {
      await app.service('practices').create({
        title: 'Fake System',
        description: 'Trying to create system practice',
        organizationId: org.id,
        isSystem: true,
      } as any);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
    }
  });

  it('prevents deleting system practices', async () => {
    const results = await app.service('practices').find({
      query: { organizationId: org.id, isSystem: true, $limit: 1 },
      paginate: false,
    }) as any[];

    try {
      await app.service('practices').remove(results[0].id);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
    }
  });

  it('prevents editing title/description on system practices', async () => {
    const results = await app.service('practices').find({
      query: { organizationId: org.id, isSystem: true, $limit: 1 },
      paginate: false,
    }) as any[];

    try {
      await app.service('practices').patch(results[0].id, {
        title: 'Modified Title',
      });
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
    }
  });

  it('allows editing custom practices', async () => {
    const results = await app.service('practices').find({
      query: { organizationId: org.id, isSystem: false },
      paginate: false,
    }) as any[];

    const custom = results[0];
    const updated: any = await app.service('practices').patch(custom.id, {
      title: 'Updated Custom Practice',
      description: 'Updated description',
    });

    assert.strictEqual(updated.title, 'Updated Custom Practice');
    assert.strictEqual(updated.description, 'Updated description');
  });

  it('allows deleting custom practices', async () => {
    const practice: any = await app.service('practices').create({
      title: 'To Delete',
      description: 'Will be deleted',
      organizationId: org.id,
    });

    const removed: any = await app.service('practices').remove(practice.id);
    assert.strictEqual(removed.id, practice.id);
  });

  it('isolates practices by organization', async () => {
    const org2 = await createTestOrganization({ name: 'Practices Test Org 2' });

    // Seed system practices for org2
    await app.service('practices').find({
      query: { organizationId: org2.id },
      paginate: false,
    });

    await app.service('practices').create({
      title: 'Org2 Practice',
      description: 'Should only appear in org2',
      organizationId: org2.id,
    });

    const org1Results = await app.service('practices').find({
      query: { organizationId: org.id },
      paginate: false,
    }) as any[];

    const org2Results = await app.service('practices').find({
      query: { organizationId: org2.id },
      paginate: false,
    }) as any[];

    const org1Custom = org1Results.filter((p: any) => !p.isSystem);
    const org2Custom = org2Results.filter((p: any) => !p.isSystem);

    assert.ok(!org1Custom.some((p: any) => p.title === 'Org2 Practice'), 'Org1 should not see org2 practices');
    assert.ok(org2Custom.some((p: any) => p.title === 'Org2 Practice'), 'Org2 should see its own practice');
  });
});
