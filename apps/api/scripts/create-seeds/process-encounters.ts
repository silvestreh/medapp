import type cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import type { MongoEncounter, ProcessingStats, SeedEncounter } from './types';

const JUANCA_ID = '540dc81947771d1f3f8b4567';

function stripClass(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__class') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripClass(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

interface DiscardedEncounter extends MongoEncounter {
  REASON: string;
}

interface ProcessEncountersOptions {
  encounters: MongoEncounter[];
  keptUserIds: Set<string>;
  keptPatientIds: Set<string>;
  weirdUserId: string | undefined;
  bar: cliProgress.SingleBar;
}

interface ProcessEncountersResult {
  encounters: SeedEncounter[];
  discardedEncounters: DiscardedEncounter[];
  patientIdsWithEncounters: Set<string>;
  stats: ProcessingStats;
}

export function processEncounters({
  encounters,
  keptUserIds,
  keptPatientIds,
  weirdUserId,
  bar,
}: ProcessEncountersOptions): ProcessEncountersResult {
  const stats: ProcessingStats = {
    total: encounters.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const kept: SeedEncounter[] = [];
  const discardedEncounters: DiscardedEncounter[] = [];
  const patientIdsWithEncounters = new Set<string>();

  for (const encounter of encounters) {
    if (!keptUserIds.has(encounter.medic_id)) {
      stats.discarded++;
      stats.reasons['missing_medic_reference'] = (stats.reasons['missing_medic_reference'] || 0) + 1;
      discardedEncounters.push({ ...encounter, REASON: 'missing_medic_reference' });
      bar.increment();
      continue;
    }

    if (!keptPatientIds.has(encounter.patient_id)) {
      stats.discarded++;
      stats.reasons['missing_patient_reference'] = (stats.reasons['missing_patient_reference'] || 0) + 1;
      discardedEncounters.push({ ...encounter, REASON: 'missing_patient_reference' });
      bar.increment();
      continue;
    }

    const timestamp = encounter.timestamp.$numberLong
      ? Number(encounter.timestamp.$numberLong)
      : Number(encounter.timestamp);

    if (isNaN(timestamp)) {
      stats.discarded++;
      stats.reasons['invalid_timestamp'] = (stats.reasons['invalid_timestamp'] || 0) + 1;
      discardedEncounters.push({ ...encounter, REASON: 'invalid_timestamp' });
      bar.increment();
      continue;
    }

    kept.push({
      data: encounter.datas ? stripClass(encounter.datas) : {},
      date: dayjs.unix(timestamp).toISOString(),
      medicId: encounter.medic_id === weirdUserId ? JUANCA_ID : encounter.medic_id,
      patientId: encounter.patient_id,
    });

    patientIdsWithEncounters.add(encounter.patient_id);
    bar.increment();
  }

  stats.kept = kept.length;

  return { encounters: kept, discardedEncounters, patientIdsWithEncounters, stats };
}
