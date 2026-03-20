import assert from 'assert';
import app from '../../src/app';

const invitesSvc = app.service('invites') as any;

describe('\'invites\' service', () => {
  let org: any;
  let adminUser: any;
  let existingUser: any;

  before(async () => {
    app.setup();
    await app.get('sequelizeSync');

    org = await app.service('organizations').create({
      name: 'Invites Test Clinic',
      slug: 'invites-test',
      isActive: true,
    });

    adminUser = await app.service('users').create({
      username: 'invite.admin',
      password: 'SuperSecret1!',
    });

    await app.service('organization-users').create({
      organizationId: org.id,
      userId: adminUser.id,
    });

    await app.service('user-roles').create({
      userId: adminUser.id,
      roleId: 'admin',
      organizationId: org.id,
    } as any);

    existingUser = await app.service('users').create({
      username: 'invite.existing',
      password: 'SuperSecret1!',
      contactData: { email: 'existing@example.com' }
    });
  });

  it('registered the service', () => {
    const service = app.service('invites');
    assert.ok(service, 'Registered the service');
  });

  describe('creating invites', () => {
    it('creates an invite for a new user (no matching email)', async () => {
      const invite: any = await app.service('invites').create(
        { email: 'brand-new@example.com', roleId: 'receptionist' },
        {
          provider: 'rest',
          user: adminUser,
          organizationId: org.id,
          authenticated: true,
        } as any
      );

      assert.ok(invite.id, 'Invite has an ID');
      assert.ok(invite.token, 'Invite has a token');
      assert.strictEqual(invite.status, 'pending');
      assert.strictEqual(invite.organizationId, org.id);
      assert.strictEqual(invite.invitedBy, adminUser.id);
      assert.ok(invite.expiresAt, 'Has expiration date');

      const fetched: any = await app.service('invites').get(invite.id);
      assert.ok(fetched.userId, 'A new user was created and linked');
      assert.strictEqual(fetched.isNewUser, true, 'Marked as new user');

      const newUser: any = await app.service('users').get(fetched.userId);
      assert.ok(newUser, 'The new user exists');
    });

    it('creates an invite for an existing user (matching email)', async () => {
      const invite: any = await app.service('invites').create(
        { email: 'existing@example.com', roleId: 'medic' },
        {
          provider: 'rest',
          user: adminUser,
          organizationId: org.id,
          authenticated: true,
        } as any
      );

      assert.ok(invite.id, 'Invite has an ID');
      assert.strictEqual(invite.status, 'pending');

      const fetched: any = await app.service('invites').get(invite.id);
      assert.strictEqual(fetched.userId, existingUser.id, 'Linked to the existing user');
      assert.strictEqual(fetched.isNewUser, false, 'Not marked as new user');
    });

    it('rejects invite when email is missing', async () => {
      try {
        await app.service('invites').create(
          { roleId: 'receptionist' },
          {
            provider: 'rest',
            user: adminUser,
            organizationId: org.id,
            authenticated: true,
          } as any
        );
        assert.fail('Should require email');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
      }
    });

    it('rejects invite when organization context is missing', async () => {
      try {
        await app.service('invites').create(
          { email: 'no-org@example.com' },
          {
            provider: 'rest',
            user: adminUser,
            authenticated: true,
          } as any
        );
        assert.fail('Should require organization');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
      }
    });

    it('rejects invite if user is already an org member', async () => {
      const memberUser: any = await app.service('users').create({
        username: 'invite.already.member',
        password: 'SuperSecret1!',
        contactData: { email: 'already-member@example.com' }
      });

      await app.service('organization-users').create({
        organizationId: org.id,
        userId: memberUser.id,
      });

      try {
        await app.service('invites').create(
          { email: 'already-member@example.com' },
          {
            provider: 'rest',
            user: adminUser,
            organizationId: org.id,
            authenticated: true,
          } as any
        );
        assert.fail('Should reject already-member invite');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.ok(error.message.includes('already a member'));
      }
    });
  });

  describe('accepting invites', () => {
    it('accepts an invite for an existing user', async () => {
      const secondOrg: any = await app.service('organizations').create({
        name: 'Accept Test Clinic',
        slug: 'accept-test',
        isActive: true,
      });

      await app.service('organization-users').create({
        organizationId: secondOrg.id,
        userId: adminUser.id,
      });

      await app.service('user-roles').create({
        userId: adminUser.id,
        roleId: 'admin',
        organizationId: secondOrg.id,
      } as any);

      const invite: any = await app.service('invites').create(
        { email: 'existing@example.com', roleId: 'medic' },
        {
          provider: 'rest',
          user: adminUser,
          organizationId: secondOrg.id,
          authenticated: true,
        } as any
      );

      const fetched: any = await app.service('invites').get(invite.id);
      assert.strictEqual(fetched.userId, existingUser.id);

      const accepted: any = await invitesSvc.patch(
        invite.id,
        { action: 'accept' },
        { provider: 'rest' }
      );

      assert.strictEqual(accepted.status, 'accepted');

      const memberships = await app.service('organization-users').find({
        query: { organizationId: secondOrg.id, userId: existingUser.id },
        paginate: false
      } as any) as any[];

      assert.strictEqual(memberships.length, 1, 'User was added to org');
    });

    it('accepts an invite for a new user and sets password', async () => {
      const thirdOrg: any = await app.service('organizations').create({
        name: 'New User Accept Clinic',
        slug: 'new-user-accept-test',
        isActive: true,
      });

      await app.service('organization-users').create({
        organizationId: thirdOrg.id,
        userId: adminUser.id,
      });

      await app.service('user-roles').create({
        userId: adminUser.id,
        roleId: 'admin',
        organizationId: thirdOrg.id,
      } as any);

      const invite: any = await app.service('invites').create(
        { email: 'totally-new@example.com', roleId: 'receptionist' },
        {
          provider: 'rest',
          user: adminUser,
          organizationId: thirdOrg.id,
          authenticated: true,
        } as any
      );

      const fetched: any = await app.service('invites').get(invite.id);
      assert.ok(fetched.userId, 'New user was created');
      assert.strictEqual(fetched.isNewUser, true);

      const accepted: any = await invitesSvc.patch(
        invite.id,
        { action: 'accept', password: 'MyNewPass123!' },
        { provider: 'rest' }
      );

      assert.strictEqual(accepted.status, 'accepted');

      const memberships = await app.service('organization-users').find({
        query: { organizationId: thirdOrg.id, userId: fetched.userId },
        paginate: false
      } as any) as any[];

      assert.strictEqual(memberships.length, 1, 'New user was added to org');
    });

    it('rejects accepting an already-accepted invite', async () => {
      const org4: any = await app.service('organizations').create({
        name: 'Double Accept Clinic',
        slug: 'double-accept-test',
        isActive: true,
      });

      await app.service('organization-users').create({
        organizationId: org4.id,
        userId: adminUser.id,
      });

      await app.service('user-roles').create({
        userId: adminUser.id,
        roleId: 'admin',
        organizationId: org4.id,
      } as any);

      const invite: any = await app.service('invites').create(
        { email: 'double-accept@example.com', roleId: 'receptionist' },
        {
          provider: 'rest',
          user: adminUser,
          organizationId: org4.id,
          authenticated: true,
        } as any
      );

      await invitesSvc.patch(
        invite.id,
        { action: 'accept' },
        { provider: 'rest' }
      );

      try {
        await invitesSvc.patch(
          invite.id,
          { action: 'accept' },
          { provider: 'rest' }
        );
        assert.fail('Should reject already-accepted invite');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
        assert.ok(error.message.includes('accepted'));
      }
    });
  });

  describe('finding invites by token', () => {
    it('allows public lookup by token', async () => {
      const invite: any = await app.service('invites').create(
        { email: 'token-lookup@example.com', roleId: 'receptionist' },
        {
          provider: 'rest',
          user: adminUser,
          organizationId: org.id,
          authenticated: true,
        } as any
      );

      const fetched: any = await app.service('invites').get(invite.id);

      const result: any = await app.service('invites').find({
        query: { token: fetched.token },
        provider: 'rest',
      } as any);

      const items = result.data || result;
      assert.strictEqual(items.length, 1, 'Found the invite by token');
      assert.strictEqual(items[0].id, invite.id);
      assert.ok(!items[0].email, 'Email is sanitized for public lookup');
    });
  });
});
