import pLimit from 'p-limit';
import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedUser } from '../create-seeds/types';

interface ImportUsersOptions {
  users: SeedUser[];
  resetPasswords: boolean;
  organizationId: string;
  bar: cliProgress.SingleBar;
}

export interface ImportUsersResult {
  validUserIds: Set<string>;
  skipped: Array<{ item: SeedUser; reason: string }>;
}

const CONCURRENCY = 5;

const JUANCA_ID = '540dc81947771d1f3f8b4567';

export async function importUsers({ users, resetPasswords, organizationId, bar }: ImportUsersOptions): Promise<ImportUsersResult> {
  const usersService = app.service('users');
  const mdSettingsService = app.service('md-settings');
  const userRolesService = app.service('user-roles');
  const orgUsersService = app.service('organization-users');
  const validUserIds = new Set<string>();
  const skipped: ImportUsersResult['skipped'] = [];

  const limit = pLimit(CONCURRENCY);

  await Promise.all(users.map(user => limit(async () => {
    try {
      const { mdSettings, additionalRoleIds, ...userData } = user;
      if (resetPasswords) {
        userData.password = 'Retrete4u!';
      }
      await usersService.create(userData as any);
      validUserIds.add(user.id);

      const orgRole = user.id === JUANCA_ID ? 'owner' : (user.roleId === 'admin' ? 'admin' : 'member');
      await orgUsersService.create({
        organizationId,
        userId: user.id,
        role: orgRole,
      } as any);

      if (additionalRoleIds) {
        for (const roleId of additionalRoleIds) {
          await userRolesService.create({ userId: user.id, roleId });
        }
      }

      if (mdSettings) {
        await mdSettingsService.create({ ...mdSettings, organizationId } as any);
      }
    } catch (error: any) {
      skipped.push({ item: user, reason: `create failed: ${error?.message || String(error)}` });
    }

    bar.increment();
  })));

  return { validUserIds, skipped };
}
