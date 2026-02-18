import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedStudy } from '../create-seeds/types';

interface ImportStudiesOptions {
  studies: SeedStudy[];
  mongoToRealPatientId: Map<string, string>;
  bar: cliProgress.SingleBar;
}

export interface ImportStudiesResult {
  importedCount: number;
  skippedCount: number;
  seedToRealStudyId: Map<string, string>;
  skipped: Array<{ item: SeedStudy; reason: string }>;
}

export async function importStudies({
  studies,
  mongoToRealPatientId,
  bar,
}: ImportStudiesOptions): Promise<ImportStudiesResult> {
  const studiesService = app.service('studies');
  const seedToRealStudyId = new Map<string, string>();
  let importedCount = 0;
  let skippedCount = 0;
  const skipped: ImportStudiesResult['skipped'] = [];

  for (const study of studies) {
    const realPatientId = mongoToRealPatientId.get(study.patientId);

    if (!realPatientId) {
      skipped.push({ item: study, reason: `patientId "${study.patientId}" not found in imported patients` });
      skippedCount++;
      bar.increment();
      continue;
    }

    try {
      const created = await studiesService.create({
        ...study,
        date: new Date(study.date),
        patientId: realPatientId,
      } as any);
      seedToRealStudyId.set(study.id, (created as any).id);
      importedCount++;
    } catch (error: any) {
      skipped.push({ item: study, reason: `create failed: ${error?.message || String(error)}` });
      skippedCount++;
    }

    bar.increment();
  }

  return { importedCount, skippedCount, seedToRealStudyId, skipped };
}
