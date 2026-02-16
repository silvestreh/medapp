import fs from 'fs/promises';
import path from 'path';
import dayjs from 'dayjs';

import app from '../src/app';

interface MongoId {
  $oid: string;
}

interface LicenseDumpItem {
  _id: MongoId;
  medic: MongoId;
  start: number;
  end: number;
  type: 'vacation' | 'cancelDay' | 'other' | string;
}

interface ImportStats {
  total: number;
  imported: number;
  skippedOld: number;
  skippedMissingMedic: number;
  skippedInvalid: number;
  skippedDuplicate: number;
}

const VALID_TYPES = new Set(['vacation', 'cancelDay', 'other']);

function normalizeType(type: string): 'vacation' | 'cancelDay' | 'other' {
  if (VALID_TYPES.has(type)) {
    return type as 'vacation' | 'cancelDay' | 'other';
  }

  return 'other';
}

async function readDump(): Promise<LicenseDumpItem[]> {
  const dumpPath = path.join(__dirname, './dumps/licenses.json');
  const payload = await fs.readFile(dumpPath, 'utf-8');
  return JSON.parse(payload) as LicenseDumpItem[];
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const usersService = app.service('users');
  const timeOffEventsService = app.service('time-off-events');
  const cutoffDate = dayjs().subtract(1, 'month');

  const stats: ImportStats = {
    total: 0,
    imported: 0,
    skippedOld: 0,
    skippedMissingMedic: 0,
    skippedInvalid: 0,
    skippedDuplicate: 0,
  };

  const items = await readDump();
  stats.total = items.length;

  for (const item of items) {
    const medicId = item?.medic?.$oid;
    const startUnix = Number(item?.start);
    const endUnix = Number(item?.end);

    if (!medicId || Number.isNaN(startUnix) || Number.isNaN(endUnix)) {
      stats.skippedInvalid += 1;
      continue;
    }

    const startDate = dayjs.unix(startUnix).startOf('day');
    const endDate = dayjs.unix(endUnix).endOf('day');

    if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
      stats.skippedInvalid += 1;
      continue;
    }

    if (endDate.isBefore(cutoffDate)) {
      stats.skippedOld += 1;
      continue;
    }

    try {
      await usersService.get(medicId);
    } catch (error) {
      stats.skippedMissingMedic += 1;
      continue;
    }

    const type = normalizeType(item.type);
    const existing = await timeOffEventsService.find({
      query: {
        medicId,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        type,
        $limit: 1,
      },
      paginate: false,
    });

    if (existing.length > 0) {
      stats.skippedDuplicate += 1;
      continue;
    }

    if (!dryRun) {
      await timeOffEventsService.create({
        medicId,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        type,
        notes: null,
      });
    }

    stats.imported += 1;
  }

  console.log('Time-off import completed');
  console.log({
    dryRun,
    cutoffDate: cutoffDate.toISOString(),
    ...stats,
  });
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed to import time-off events:', error);
    process.exit(1);
  });
