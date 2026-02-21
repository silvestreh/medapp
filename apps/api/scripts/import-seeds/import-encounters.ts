import pLimit from 'p-limit';
import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedEncounter } from '../create-seeds/types';

interface ImportEncountersOptions {
  encounters: SeedEncounter[];
  validUserIds: Set<string>;
  mongoToRealPatientId: Map<string, string>;
  bar: cliProgress.SingleBar;
}

export interface ImportEncountersResult {
  importedCount: number;
  skippedCount: number;
  skipped: Array<{ item: SeedEncounter; reason: string }>;
}

const CONCURRENCY = 20;

export async function importEncounters({
  encounters,
  validUserIds,
  mongoToRealPatientId,
  bar,
}: ImportEncountersOptions): Promise<ImportEncountersResult> {
  const encountersService = app.service('encounters');
  let importedCount = 0;
  let skippedCount = 0;
  const skipped: ImportEncountersResult['skipped'] = [];

  const limit = pLimit(CONCURRENCY);

  await Promise.all(encounters.map(encounter => limit(async () => {
    const realPatientId = mongoToRealPatientId.get(encounter.patientId);

    if (!validUserIds.has(encounter.medicId)) {
      skipped.push({ item: encounter, reason: `medicId "${encounter.medicId}" not found in imported users` });
      skippedCount++;
      bar.increment();
      return;
    }

    if (!realPatientId) {
      skipped.push({ item: encounter, reason: `patientId "${encounter.patientId}" not found in imported patients` });
      skippedCount++;
      bar.increment();
      return;
    }

    try {
      await encountersService.create({
        ...encounter,
        date: new Date(encounter.date),
        patientId: realPatientId,
      } as any);
      importedCount++;
    } catch (error: any) {
      skipped.push({ item: encounter, reason: `create failed: ${error?.message || String(error)}` });
      skippedCount++;
    }

    bar.increment();
  })));

  return { importedCount, skippedCount, skipped };
}
