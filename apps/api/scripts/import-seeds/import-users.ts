import pLimit from 'p-limit';
import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedUser } from '../create-seeds/types';

const DEFAULT_PASSWORD = 'Retrete4u!';

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
      const { mdSettings, additionalRoleIds, roleId, ...userData } = user;

      userData.password = resetPasswords
        ? DEFAULT_PASSWORD
        : DEFAULT_PASSWORD;

      await usersService.create(userData as any);
      validUserIds.add(user.id);

      await orgUsersService.create({
        organizationId,
        userId: user.id,
      } as any);

      if (user.id === JUANCA_ID) {
        await userRolesService.create({ userId: user.id, roleId: 'owner', organizationId } as any);
      }

      await userRolesService.create({ userId: user.id, roleId, organizationId } as any);

      if (additionalRoleIds) {
        for (const addlRoleId of additionalRoleIds) {
          await userRolesService.create({ userId: user.id, roleId: addlRoleId, organizationId } as any);
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
