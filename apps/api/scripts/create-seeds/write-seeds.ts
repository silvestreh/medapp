import fs from 'fs/promises';
import path from 'path';
import type {
  MongoEncounter,
  MongoStudy,
  SeedUser,
  SeedPatient,
  SeedEncounter,
  SeedAppointment,
  SeedStudy,
  SeedResult,
  SeedLicense,
} from './types';

const SEEDS_DIR = path.join(__dirname, '../seeds');
const DISCARDED_DIR = path.join(SEEDS_DIR, 'discarded');

interface SeedData {
  users: SeedUser[];
  patients: SeedPatient[];
  encounters: SeedEncounter[];
  appointments: SeedAppointment[];
  studies: SeedStudy[];
  studyResults: SeedResult[];
  licenses: SeedLicense[];
}

interface DiscardedData {
  encounters: MongoEncounter[];
  studies: MongoStudy[];
}

const FILES: { key: keyof SeedData; filename: string }[] = [
  { key: 'users', filename: 'user.seed.json' },
  { key: 'patients', filename: 'patient.seed.json' },
  { key: 'encounters', filename: 'encounter.seed.json' },
  { key: 'appointments', filename: 'appointment.seed.json' },
  { key: 'studies', filename: 'studies.seed.json' },
  { key: 'studyResults', filename: 'results.seed.json' },
  { key: 'licenses', filename: 'licenses.seed.json' },
];

export async function writeSeeds(
  data: SeedData,
  discarded?: DiscardedData,
): Promise<void> {
  await fs.mkdir(SEEDS_DIR, { recursive: true });

  const writes = FILES.map(({ key, filename }) =>
    fs.writeFile(
      path.join(SEEDS_DIR, filename),
      JSON.stringify(data[key], null, 2),
    ),
  );

  if (discarded) {
    const hasDiscardedEncounters = discarded.encounters.length > 0;
    const hasDiscardedStudies = discarded.studies.length > 0;

    if (hasDiscardedEncounters || hasDiscardedStudies) {
      await fs.mkdir(DISCARDED_DIR, { recursive: true });

      if (hasDiscardedEncounters) {
        writes.push(
          fs.writeFile(
            path.join(DISCARDED_DIR, 'encounters.json'),
            JSON.stringify(discarded.encounters, null, 2),
          ),
        );
      }

      if (hasDiscardedStudies) {
        writes.push(
          fs.writeFile(
            path.join(DISCARDED_DIR, 'studies.json'),
            JSON.stringify(discarded.studies, null, 2),
          ),
        );
      }
    }
  }

  await Promise.all(writes);
}
