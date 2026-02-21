import pLimit from 'p-limit';
import type cliProgress from 'cli-progress';
import app from '../../src/app';
import type { SeedPatient } from '../create-seeds/types';

interface ImportPatientsOptions {
  patients: SeedPatient[];
  bar: cliProgress.SingleBar;
}

export interface ImportPatientsResult {
  validPatientIds: Set<string>;
  mongoToRealPatientId: Map<string, string>;
  skipped: Array<{ item: SeedPatient; reason: string }>;
}

const CONCURRENCY = 15;

export async function importPatients({
  patients,
  bar,
}: ImportPatientsOptions): Promise<ImportPatientsResult> {
  const personalDataService = app.service('personal-data');
  const patientPersonalDataService = app.service('patient-personal-data');
  const patientsService = app.service('patients');
  const validPatientIds = new Set<string>();
  const mongoToRealPatientId = new Map<string, string>();
  const skipped: ImportPatientsResult['skipped'] = [];

  const limit = pLimit(CONCURRENCY);

  await Promise.all(patients.map(patient => limit(async () => {
    const documentValue = patient.personalData?.documentValue;

    if (documentValue) {
      try {
        const existingPersonalData = (await personalDataService.find({
          query: { documentValue, $limit: 1 },
          paginate: false,
        })) as any[];

        if (existingPersonalData.length > 0) {
          const pdId = existingPersonalData[0].id;
          const patientLink = (await patientPersonalDataService.find({
            query: { personalDataId: pdId, $limit: 1 },
            paginate: false,
          })) as any[];

          if (patientLink.length > 0) {
            const existingPatientId = patientLink[0].ownerId;
            mongoToRealPatientId.set(patient.id, existingPatientId);
            validPatientIds.add(existingPatientId);
            bar.increment();
            return;
          }
        }
      } catch {
        // proceed to create
      }
    }

    try {
      const newPatient = (await patientsService.create(patient as any)) as any;
      validPatientIds.add(newPatient.id);
      mongoToRealPatientId.set(patient.id, newPatient.id);
    } catch (error: any) {
      skipped.push({
        item: patient,
        reason: `create failed: ${error?.message || String(error)}`,
      });
    }

    bar.increment();
  })));

  return { validPatientIds, mongoToRealPatientId, skipped };
}
