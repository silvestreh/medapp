import type cliProgress from 'cli-progress';
import { omit } from 'lodash';
import type { MongoStudyResult, ProcessingStats, SeedResult } from './types';

interface ProcessResultsOptions {
  studyResults: MongoStudyResult[];
  keptStudyIds: Set<string>;
  bar: cliProgress.SingleBar;
}

interface ProcessResultsResult {
  studyResults: SeedResult[];
  stats: ProcessingStats;
}

export function processResults({
  studyResults,
  keptStudyIds,
  bar,
}: ProcessResultsOptions): ProcessResultsResult {
  const stats: ProcessingStats = {
    total: studyResults.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const kept: SeedResult[] = [];

  for (const result of studyResults) {
    if (!keptStudyIds.has(result.study.$oid)) {
      stats.discarded++;
      stats.reasons['missing_study_reference'] = (stats.reasons['missing_study_reference'] || 0) + 1;
      bar.increment();
      continue;
    }

    kept.push({
      id: result._id.$oid,
      data: JSON.stringify(omit(result.data, '__class')),
      studyId: result.study.$oid,
      type: result.type,
    });

    bar.increment();
  }

  stats.kept = kept.length;

  return { studyResults: kept, stats };
}
