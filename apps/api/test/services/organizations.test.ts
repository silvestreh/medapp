import assert from 'assert';
import app from '../../src/app';

describe('\'organizations\' service', () => {
  it('registered the service', () => {
    const service = app.service('organizations');
    assert.ok(service, 'Registered the service');
  });

  it('creates an organization', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Test Clinic',
      slug: 'test-clinic'
    });

    assert.ok(org.id, 'Organization has an ID');
    assert.strictEqual(org.name, 'Test Clinic');
    assert.strictEqual(org.slug, 'test-clinic');
    assert.deepStrictEqual(org.settings, {});
  });

  it('enforces unique slug', async () => {
    await app.service('organizations').create({
      name: 'Unique Slug Org',
      slug: 'unique-slug'
    });

    try {
      await app.service('organizations').create({
        name: 'Duplicate Slug Org',
        slug: 'unique-slug'
      });
      assert.fail('Should not allow duplicate slug');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate slug');
    }
  });

  it('restricts patch to organization owner', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Owner Only Org',
      slug: 'owner-only-org'
    });

    const owner: any = await app.service('users').create({
      username: 'org.owner.patch',
      password: 'supersecret',
      roleId: 'medic'
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: owner.id,
      role: 'owner'
    });

    const patched: any = await app.service('organizations').patch(org.id, {
      name: 'Updated By Owner'
    }, { user: owner } as any);

    assert.strictEqual(patched.name, 'Updated By Owner');
  });

  it('rejects patch from non-owner', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Non Owner Org',
      slug: 'non-owner-org'
    });

    const member: any = await app.service('users').create({
      username: 'org.member.patch',
      password: 'supersecret',
      roleId: 'medic'
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: member.id,
      role: 'member'
    });

    try {
      await app.service('organizations').patch(org.id, {
        name: 'Should Not Work'
      }, { user: member } as any);
      assert.fail('Should not allow non-owner to patch');
    } catch (error: any) {
      assert.strictEqual(error.name, 'Forbidden');
    }
  });

  it('stores JSON settings', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Settings Org',
      slug: 'settings-org',
      settings: { theme: 'dark', features: ['lab', 'rx'] }
    });

    const fetched: any = await app.service('organizations').get(org.id);
    assert.deepStrictEqual(fetched.settings, { theme: 'dark', features: ['lab', 'rx'] });
  });
});
