import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedLicense } from '../create-seeds/types';

interface ImportLicensesOptions {
  licenses: SeedLicense[];
  validUserIds: Set<string>;
  bar: cliProgress.SingleBar;
}

export interface ImportLicensesResult {
  importedCount: number;
  skippedCount: number;
  skipped: Array<{ item: SeedLicense; reason: string }>;
}

export async function importLicenses({
  licenses,
  validUserIds,
  bar,
}: ImportLicensesOptions): Promise<ImportLicensesResult> {
  const timeOffEventsService = app.service('time-off-events');
  let importedCount = 0;
  let skippedCount = 0;
  const skipped: ImportLicensesResult['skipped'] = [];

  for (const license of licenses) {
    if (!validUserIds.has(license.medicId)) {
      skipped.push({ item: license, reason: `medicId "${license.medicId}" not found in imported users` });
      skippedCount++;
      bar.increment();
      continue;
    }

    try {
      await timeOffEventsService.create({
        ...license,
        startDate: new Date(license.startDate),
        endDate: new Date(license.endDate),
      } as any);
      importedCount++;
    } catch (error: any) {
      skipped.push({ item: license, reason: `create failed: ${error?.message || String(error)}` });
      skippedCount++;
    }

    bar.increment();
  }

  return { importedCount, skippedCount, skipped };
}
