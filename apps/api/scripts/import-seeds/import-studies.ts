import pLimit from 'p-limit';
import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedStudy } from '../create-seeds/types';

interface ImportStudiesOptions {
  studies: SeedStudy[];
  mongoToRealPatientId: Map<string, string>;
  organizationId: string;
  bar: cliProgress.SingleBar;
}

export interface ImportStudiesResult {
  importedCount: number;
  skippedCount: number;
  seedToRealStudyId: Map<string, string>;
  skipped: Array<{ item: SeedStudy; reason: string }>;
}

const CONCURRENCY = 20;

export async function importStudies({
  studies,
  mongoToRealPatientId,
  organizationId,
  bar,
}: ImportStudiesOptions): Promise<ImportStudiesResult> {
  const studiesService = app.service('studies');
  const patientsService = app.service('patients');
  const seedToRealStudyId = new Map<string, string>();
  const insurerIdByPatientId = new Map<string, string | null>();
  let importedCount = 0;
  let skippedCount = 0;
  const skipped: ImportStudiesResult['skipped'] = [];

  const limit = pLimit(CONCURRENCY);

  await Promise.all(studies.map(study => limit(async () => {
    const realPatientId = mongoToRealPatientId.get(study.patientId);

    if (!realPatientId) {
      skipped.push({ item: study, reason: `patientId "${study.patientId}" not found in imported patients` });
      skippedCount++;
      bar.increment();
      return;
    }

    try {
      let insurerId = study.insurerId ?? null;
      if (!insurerId) {
        if (!insurerIdByPatientId.has(realPatientId)) {
          const patient = await patientsService.get(realPatientId, { disableSoftDelete: true });
          insurerIdByPatientId.set(realPatientId, patient?.medicareId ?? null);
        }
        insurerId = insurerIdByPatientId.get(realPatientId) ?? null;
      }

      const created = await studiesService.create({
        ...study,
        date: new Date(study.date),
        patientId: realPatientId,
        insurerId,
        organizationId,
      } as any);
      seedToRealStudyId.set(study.id, (created as any).id);
      importedCount++;
    } catch (error: any) {
      skipped.push({ item: study, reason: `create failed: ${error?.message || String(error)}` });
      skippedCount++;
    }

    bar.increment();
  })));

  return { importedCount, skippedCount, seedToRealStudyId, skipped };
}
