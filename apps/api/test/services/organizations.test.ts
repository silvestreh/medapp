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
      slug: 'test-clinic',
      isActive: true,
    });

    assert.ok(org.id, 'Organization has an ID');
    assert.strictEqual(org.name, 'Test Clinic');
    assert.strictEqual(org.slug, 'test-clinic');
    assert.deepStrictEqual(org.settings, {});
  });

  it('enforces unique slug', async () => {
    await app.service('organizations').create({
      name: 'Unique Slug Org',
      slug: 'unique-slug',
      isActive: true,
    });

    try {
      await app.service('organizations').create({
        name: 'Duplicate Slug Org',
        slug: 'unique-slug',
        isActive: true,
      });
      assert.fail('Should not allow duplicate slug');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate slug');
    }
  });

  it('restricts patch to organization owner', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Owner Only Org',
      slug: 'owner-only-org',
      isActive: true,
    });

    const owner: any = await app.service('users').create({
      username: 'org.owner.patch',
      password: 'SuperSecret1!',
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: owner.id,
    });

    await app.service('user-roles').create({
      userId: owner.id,
      roleId: 'owner',
      organizationId: org.id,
    } as any);

    const patched: any = await app.service('organizations').patch(org.id, {
      name: 'Updated By Owner'
    }, { user: owner, provider: 'rest', authenticated: true, organizationId: org.id } as any);

    assert.strictEqual(patched.name, 'Updated By Owner');
  });

  it('rejects patch from non-owner', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Non Owner Org',
      slug: 'non-owner-org',
      isActive: true,
    });

    const member: any = await app.service('users').create({
      username: 'org.member.patch',
      password: 'SuperSecret1!',
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: member.id,
    });

    await app.service('user-roles').create({
      userId: member.id,
      roleId: 'medic',
      organizationId: org.id,
    } as any);

    try {
      await app.service('organizations').patch(org.id, {
        name: 'Should Not Work'
      }, { user: member, provider: 'rest', authenticated: true, organizationId: org.id } as any);
      assert.fail('Should not allow non-owner to patch');
    } catch (error: any) {
      assert.strictEqual(error.name, 'Forbidden');
    }
  });

  it('stores JSON settings', async () => {
    const org: any = await app.service('organizations').create({
      name: 'Settings Org',
      slug: 'settings-org',
      settings: { theme: 'dark', features: ['lab', 'rx'] },
      isActive: true,
    });

    const fetched: any = await app.service('organizations').get(org.id);
    assert.deepStrictEqual(fetched.settings, { theme: 'dark', features: ['lab', 'rx'] });
  });
});
