import type cliProgress from 'cli-progress';
import dayjs from 'dayjs';
import type { MongoLicense, ProcessingStats, SeedLicense } from './types';

interface ProcessLicensesOptions {
  licenses: MongoLicense[];
  keptUserIds: Set<string>;
  bar: cliProgress.SingleBar;
}

interface ProcessLicensesResult {
  licenses: SeedLicense[];
  stats: ProcessingStats;
}

export function processLicenses({
  licenses,
  keptUserIds,
  bar,
}: ProcessLicensesOptions): ProcessLicensesResult {
  const stats: ProcessingStats = {
    total: licenses.length,
    kept: 0,
    discarded: 0,
    reasons: {},
  };

  const oneMonthAgo = dayjs().subtract(1, 'month').startOf('day');
  const kept: SeedLicense[] = [];
  const dedupeKeys = new Set<string>();

  for (const license of licenses) {
    const medicId = license?.medic?.$oid;
    const startTimestamp = Number(license?.start);
    const endTimestamp = Number(license?.end);

    if (!medicId || isNaN(startTimestamp) || isNaN(endTimestamp)) {
      stats.discarded++;
      stats.reasons['invalid_license_data'] = (stats.reasons['invalid_license_data'] || 0) + 1;
      bar.increment();
      continue;
    }

    if (!keptUserIds.has(medicId)) {
      stats.discarded++;
      stats.reasons['missing_medic_reference'] = (stats.reasons['missing_medic_reference'] || 0) + 1;
      bar.increment();
      continue;
    }

    const startDate = dayjs.unix(startTimestamp).startOf('day');
    const endDate = dayjs.unix(endTimestamp).endOf('day');

    if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
      stats.discarded++;
      stats.reasons['invalid_date_range'] = (stats.reasons['invalid_date_range'] || 0) + 1;
      bar.increment();
      continue;
    }

    if (endDate.isBefore(oneMonthAgo)) {
      stats.discarded++;
      stats.reasons['license_too_old'] = (stats.reasons['license_too_old'] || 0) + 1;
      bar.increment();
      continue;
    }

    const normalizedType: SeedLicense['type'] =
      license.type === 'vacation' || license.type === 'cancelDay' || license.type === 'other'
        ? license.type
        : 'other';

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    const dedupeKey = `${medicId}:${startISO}:${endISO}:${normalizedType}`;

    if (dedupeKeys.has(dedupeKey)) {
      stats.discarded++;
      stats.reasons['duplicate_license'] = (stats.reasons['duplicate_license'] || 0) + 1;
      bar.increment();
      continue;
    }

    dedupeKeys.add(dedupeKey);

    kept.push({
      medicId,
      startDate: startISO,
      endDate: endISO,
      type: normalizedType,
      notes: null,
    });

    bar.increment();
  }

  stats.kept = kept.length;

  return { licenses: kept, stats };
}
