import assert from 'assert';
import app from '../../src/app';

describe('\'organization-users\' service', () => {
  let org: any;
  let user: any;

  before(async () => {
    org = await app.service('organizations').create({
      name: 'OrgUsers Test Clinic',
      slug: 'org-users-test'
    });

    user = await app.service('users').create({
      username: 'org.member.test',
      password: 'SuperSecret1',
      roleId: 'medic'
    });
  });

  it('registered the service', () => {
    const service = app.service('organization-users');
    assert.ok(service, 'Registered the service');
  });

  it('adds a user to an organization', async () => {
    const membership: any = await app.service('organization-users').create({
      organizationId: org.id,
      userId: user.id,
      role: 'owner'
    });

    assert.ok(membership.id, 'Membership has an ID');
    assert.strictEqual(membership.organizationId, org.id);
    assert.strictEqual(membership.userId, user.id);
    assert.strictEqual(membership.role, 'owner');
  });

  it('defaults role to member', async () => {
    const anotherUser = await app.service('users').create({
      username: 'org.default.role',
      password: 'SuperSecret1',
      roleId: 'receptionist'
    });

    const membership: any = await app.service('organization-users').create({
      organizationId: org.id,
      userId: anotherUser.id
    });

    assert.strictEqual(membership.role, 'member');
  });

  it('enforces unique organization-user pair', async () => {
    const uniqueUser = await app.service('users').create({
      username: 'org.unique.pair',
      password: 'SuperSecret1',
      roleId: 'medic'
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: uniqueUser.id
    });

    try {
      await app.service('organization-users').create({
        organizationId: org.id,
        userId: uniqueUser.id
      });
      assert.fail('Should not allow duplicate membership');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate membership');
    }
  });

  it('finds members by organizationId', async () => {
    const results = await app.service('organization-users').find({
      query: { organizationId: org.id },
      paginate: false
    } as any) as any[];

    assert.ok(results.length > 0, 'Found members');
    assert.ok(
      results.every((r: any) => r.organizationId === org.id),
      'All results belong to the correct organization'
    );
  });
});
