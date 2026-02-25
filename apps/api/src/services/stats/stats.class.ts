import { Sequelize, QueryTypes } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import dayjs from 'dayjs';

import type { Application } from '../../declarations';
import { decryptValue } from '../../hooks/encryption';

const AGE_BUCKETS = ['0-17', '18-34', '35-49', '50-64', '65+'] as const;
type AgeBucket = typeof AGE_BUCKETS[number];

export interface StudyTypeCount {
  studyType: string;
  count: number;
}

export interface AgeGroupEntry {
  studyType: string;
  bucket: AgeBucket;
  count: number;
}

export interface StatsResult {
  studyTypeCounts: StudyTypeCount[];
  ageGroups: AgeGroupEntry[];
}

function ageToBucket(age: number): AgeBucket {
  if (age < 18) return '0-17';
  if (age < 35) return '18-34';
  if (age < 50) return '35-49';
  if (age < 65) return '50-64';
  return '65+';
}

export class Stats {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params?: Params): Promise<StatsResult> {
    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const organizationId = params?.organizationId;
    const query = params?.query || {};
    const { from, to } = query;

    if (!from || !to) {
      throw new BadRequest('Both "from" and "to" query params are required');
    }

    const fromDate = dayjs(from);
    const toDate = dayjs(to);

    if (!fromDate.isValid() || !toDate.isValid()) {
      throw new BadRequest('"from" and "to" must be valid dates');
    }

    if (toDate.isBefore(fromDate)) {
      throw new BadRequest('"to" must be after "from"');
    }

    const orgFilter = organizationId
      ? `AND s."organizationId" = :organizationId`
      : '';

    const replacements: Record<string, string> = {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    };

    if (organizationId) {
      replacements.organizationId = organizationId;
    }

    const studyTypeCounts = await sequelize.query<StudyTypeCount>(
      `
      SELECT UNNEST(s.studies) AS "studyType", COUNT(*)::int AS count
      FROM studies s
      WHERE s.date >= :from AND s.date <= :to
      ${orgFilter}
      GROUP BY "studyType"
      ORDER BY count DESC
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const patientStudyRows = await sequelize.query<{
      patientId: string;
      studyType: string;
    }>(
      `
      SELECT DISTINCT s."patientId", UNNEST(s.studies) AS "studyType"
      FROM studies s
      WHERE s.date >= :from AND s.date <= :to
      ${orgFilter}
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    if (patientStudyRows.length === 0) {
      return { studyTypeCounts, ageGroups: [] };
    }

    const patientIds = [...new Set(patientStudyRows.map(r => r.patientId))];

    const birthRows = await sequelize.query<{
      ownerId: string;
      birthDate: string | null;
    }>(
      `
      SELECT ppd."ownerId", pd."birthDate"
      FROM patient_personal_data ppd
      JOIN personal_data pd ON pd.id = ppd."personalDataId"
      WHERE ppd."ownerId" IN (:patientIds)
      `,
      { type: QueryTypes.SELECT, replacements: { patientIds } }
    );

    const birthByPatient = new Map<string, string | null>();
    for (const row of birthRows) {
      if (row.birthDate) {
        const decrypted = decryptValue(row.birthDate);
        birthByPatient.set(row.ownerId, decrypted);
      }
    }

    const bucketMap = new Map<string, Map<AgeBucket, number>>();

    for (const { patientId, studyType } of patientStudyRows) {
      const rawBirth = birthByPatient.get(patientId);
      if (!rawBirth) continue;

      const birth = dayjs(rawBirth);
      if (!birth.isValid()) continue;

      const age = dayjs().diff(birth, 'year');
      const bucket = ageToBucket(age);

      if (!bucketMap.has(studyType)) {
        bucketMap.set(studyType, new Map());
      }
      const typeBuckets = bucketMap.get(studyType)!;
      typeBuckets.set(bucket, (typeBuckets.get(bucket) || 0) + 1);
    }

    const ageGroups: AgeGroupEntry[] = [];
    for (const [studyType, buckets] of bucketMap) {
      for (const bucket of AGE_BUCKETS) {
        const count = buckets.get(bucket) || 0;
        if (count > 0) {
          ageGroups.push({ studyType, bucket, count });
        }
      }
    }

    return { studyTypeCounts, ageGroups };
  }
}
