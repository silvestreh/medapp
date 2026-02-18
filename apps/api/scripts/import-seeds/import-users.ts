import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedUser } from '../create-seeds/types';

interface ImportUsersOptions {
  users: SeedUser[];
  resetPasswords: boolean;
  bar: cliProgress.SingleBar;
}

export interface ImportUsersResult {
  validUserIds: Set<string>;
  skipped: Array<{ item: SeedUser; reason: string }>;
}

export async function importUsers({ users, resetPasswords, bar }: ImportUsersOptions): Promise<ImportUsersResult> {
  const usersService = app.service('users');
  const mdSettingsService = app.service('md-settings');
  const validUserIds = new Set<string>();
  const skipped: ImportUsersResult['skipped'] = [];

  for (const user of users) {
    try {
      const { mdSettings, ...userData } = user;
      if (resetPasswords) {
        userData.password = 'retrete';
      }
      await usersService.create(userData as any);
      validUserIds.add(user.id);

      if (mdSettings) {
        await mdSettingsService.create(mdSettings);
      }
    } catch (error: any) {
      skipped.push({ item: user, reason: `create failed: ${error?.message || String(error)}` });
    }

    bar.increment();
  }

  return { validUserIds, skipped };
}
