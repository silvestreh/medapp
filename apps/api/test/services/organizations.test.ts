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

  describe('slug validation', () => {
    const createOrgWithOwner = async (slug: string, suffix: string) => {
      const org: any = await app.service('organizations').create({
        name: `Slug Org ${suffix}`,
        slug,
        isActive: true,
      });

      const owner: any = await app.service('users').create({
        username: `slug.owner.${suffix}`,
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

      return { org, owner };
    };

    const ownerParams = (owner: any, orgId: string) =>
      ({ user: owner, provider: 'rest', authenticated: true, organizationId: orgId } as any);

    it('allows owner to change slug and normalizes it', async () => {
      const { org, owner } = await createOrgWithOwner('slug-change-org', 'change');

      const patched: any = await app.service('organizations').patch(org.id, {
        slug: '  My-New-Slug  ',
      }, ownerParams(owner, org.id));

      assert.strictEqual(patched.slug, 'my-new-slug');
    });

    it('allows re-patching an org with its own current slug', async () => {
      const { org, owner } = await createOrgWithOwner('slug-same-org', 'same');

      const patched: any = await app.service('organizations').patch(org.id, {
        name: 'Renamed Org',
        slug: 'slug-same-org',
      }, ownerParams(owner, org.id));

      assert.strictEqual(patched.slug, 'slug-same-org');
      assert.strictEqual(patched.name, 'Renamed Org');
    });

    it('allows patches that do not touch the slug', async () => {
      const { org, owner } = await createOrgWithOwner('slug-untouched-org', 'untouched');

      const patched: any = await app.service('organizations').patch(org.id, {
        name: 'Only Name Changed',
      }, ownerParams(owner, org.id));

      assert.strictEqual(patched.name, 'Only Name Changed');
      assert.strictEqual(patched.slug, 'slug-untouched-org');
    });

    it('rejects invalid slug formats', async () => {
      const { org, owner } = await createOrgWithOwner('slug-invalid-org', 'invalid');

      const invalidSlugs = ['under_score', '-leading', 'trailing-', 'x', 'a'.repeat(64), 'with space', 'dot.dot'];

      for (const slug of invalidSlugs) {
        try {
          await app.service('organizations').patch(org.id, { slug }, ownerParams(owner, org.id));
          assert.fail(`Should have rejected slug: ${slug}`);
        } catch (error: any) {
          assert.strictEqual(error.name, 'BadRequest', `Expected BadRequest for slug: ${slug}`);
          assert.strictEqual(error.errors?.slug, 'invalid');
        }
      }
    });

    it('rejects reserved slugs', async () => {
      const { org, owner } = await createOrgWithOwner('slug-reserved-org', 'reserved');

      // Includes labels from the booking app's RESERVED_LABELS mirror — 'demo'
      // was the drift that let an unresolvable org slug get saved.
      for (const slug of ['booking', 'www', 'auth', 'demo', 'sandbox', 'grafana', 'appointment']) {
        try {
          await app.service('organizations').patch(org.id, { slug }, ownerParams(owner, org.id));
          assert.fail(`Should have rejected reserved slug: ${slug}`);
        } catch (error: any) {
          assert.strictEqual(error.name, 'BadRequest', `Expected BadRequest for slug: ${slug}`);
          assert.strictEqual(error.errors?.slug, 'reserved');
        }
      }
    });

    it('rejects a slug already used by another organization', async () => {
      await app.service('organizations').create({
        name: 'Slug Holder Org',
        slug: 'slug-already-held',
        isActive: true,
      });

      const { org, owner } = await createOrgWithOwner('slug-conflict-org', 'conflict');

      try {
        await app.service('organizations').patch(org.id, {
          slug: 'slug-already-held',
        }, ownerParams(owner, org.id));
        assert.fail('Should have rejected duplicate slug');
      } catch (error: any) {
        assert.strictEqual(error.name, 'Conflict');
        assert.strictEqual(error.errors?.slug, 'taken');
      }
    });

    it('rejects invalid slugs on create', async () => {
      try {
        await app.service('organizations').create({
          name: 'Bad Create Org',
          slug: 'Bad Slug!',
          isActive: true,
        });
        assert.fail('Should have rejected invalid slug on create');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.strictEqual(error.errors?.slug, 'invalid');
      }
    });

    it('generates a DNS-safe slug at signup even for very long org names', async () => {
      const longName = 'Instituto de Hematología y Hemoterapia de la Provincia de Buenos Aires Sede Central';

      const user: any = await app.service('users').create({
        username: 'slug.signup.long',
        password: 'SuperSecret1!',
        signupOrganization: longName,
      } as any);

      const orgId = user.signupOrganizationId;
      assert.ok(orgId, 'Signup created an organization');

      const org: any = await app.service('organizations').get(orgId);
      assert.ok(org.slug.length <= 63, `Slug too long (${org.slug.length}): ${org.slug}`);
      assert.match(org.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });
  });
});
