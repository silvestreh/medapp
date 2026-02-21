import pLimit from 'p-limit';
import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedResult } from '../create-seeds/types';

interface ImportResultsOptions {
  studyResults: SeedResult[];
  seedToRealStudyId: Map<string, string>;
  bar: cliProgress.SingleBar;
}

export interface ImportResultsResult {
  importedCount: number;
  skippedCount: number;
  skipped: Array<{ item: SeedResult; reason: string }>;
}

const CONCURRENCY = 20;

export async function importResults({
  studyResults,
  seedToRealStudyId,
  bar,
}: ImportResultsOptions): Promise<ImportResultsResult> {
  const studyResultsService = app.service('study-results');
  let importedCount = 0;
  let skippedCount = 0;
  const skipped: ImportResultsResult['skipped'] = [];

  const limit = pLimit(CONCURRENCY);

  await Promise.all(studyResults.map(result => limit(async () => {
    const realStudyId = seedToRealStudyId.get(result.studyId);

    if (!realStudyId) {
      skipped.push({ item: result, reason: `studyId "${result.studyId}" not found in imported studies` });
      skippedCount++;
      bar.increment();
      return;
    }

    try {
      await studyResultsService.create({
        ...result,
        studyId: realStudyId,
      } as any);
      importedCount++;
    } catch (error: any) {
      skipped.push({ item: result, reason: `create failed: ${error?.message || String(error)}` });
      skippedCount++;
    }

    bar.increment();
  })));

  return { importedCount, skippedCount, skipped };
}
