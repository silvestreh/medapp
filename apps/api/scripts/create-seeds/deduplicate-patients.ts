import { groupBy } from 'lodash';
import type { MongoPatient, ProcessingStats } from './types';

interface DeduplicatePatientsResult {
  patients: MongoPatient[];
  patientIdRemap: Map<string, string>;
  stats: ProcessingStats;
}

export function deduplicatePatients(patients: MongoPatient[]): DeduplicatePatientsResult {
  const stats: ProcessingStats = {
    total: patients.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const patientIdRemap = new Map<string, string>();

  // Group by document_value (DNI)
  const grouped = groupBy(patients, p => p.personal_data?.document_value || p._id.$oid);

  const deduped: MongoPatient[] = [];

  for (const [, group] of Object.entries(grouped)) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    // Multiple patients with the same DNI
    const nonDeleted = group.filter(p => !p.deleted);
    const deleted = group.filter(p => p.deleted);

    let winner: MongoPatient;

    if (nonDeleted.length > 0) {
      // Pick the first non-deleted as the winner
      winner = nonDeleted[0];

      // Remap all other non-deleted duplicates (unlikely but possible)
      for (let i = 1; i < nonDeleted.length; i++) {
        patientIdRemap.set(nonDeleted[i]._id.$oid, winner._id.$oid);
        stats.discarded++;
        stats.reasons['non_deleted_duplicate'] = (stats.reasons['non_deleted_duplicate'] || 0) + 1;
      }
    } else {
      // All deleted: keep the first one
      winner = deleted[0];
      deleted.splice(0, 1);
    }

    // Remap all soft-deleted duplicates to the winner
    for (const dup of deleted) {
      patientIdRemap.set(dup._id.$oid, winner._id.$oid);
      stats.discarded++;
      stats.reasons['soft_deleted_duplicate'] = (stats.reasons['soft_deleted_duplicate'] || 0) + 1;
    }

    deduped.push(winner);
  }

  stats.kept = deduped.length;

  return { patients: deduped, patientIdRemap, stats };
}
