import type { Id } from '@feathersjs/feathers';
import app from '../src/app';
import type { Organization } from '../src/declarations';

export interface CreateTestUserOptions {
  username: string;
  password: string;
  roleIds: string[];
  organizationId: Id;
  isSuperAdmin?: boolean;
}

export async function createTestOrganization(
  overrides: Partial<{ name: string; slug: string; isActive: boolean }> = {}
): Promise<Organization> {
  const slug = overrides.slug || `test-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await app.service('organizations').create({
    name: overrides.name || 'Test Organization',
    slug,
    settings: {},
    ...(overrides.isActive !== undefined ? { isActive: overrides.isActive } : {}),
  } as any);
  return org as Organization;
}

export async function createTestUser({
  username,
  password,
  roleIds,
  organizationId,
  isSuperAdmin,
}: CreateTestUserOptions) {
  const user = await app.service('users').create({
    username,
    password,
  } as any);

  await app.service('organization-users').create({
    organizationId,
    userId: user.id,
  } as any);

  for (const roleId of roleIds) {
    await app.service('user-roles').create({
      userId: user.id,
      roleId,
      organizationId,
    } as any);
  }

  if (isSuperAdmin) {
    const sequelize = app.get('sequelizeClient');
    await sequelize.models.users.update(
      { isSuperAdmin: true },
      { where: { id: user.id } }
    );
  }

  return user;
}
