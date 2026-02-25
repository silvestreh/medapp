import { Sequelize, QueryTypes } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import dayjs from 'dayjs';

import type { Application } from '../../declarations';
import { decryptValue } from '../../hooks/encryption';

const AGE_BUCKETS = ['0-17', '18-34', '35-49', '50-64', '65+'] as const;
type AgeBucket = typeof AGE_BUCKETS[number];
type Gender = 'male' | 'female' | 'other';

export interface StudyTypeCount {
  studyType: string;
  count: number;
}

export interface AgeGroupEntry {
  studyType: string;
  bucket: AgeBucket;
  count: number;
}

export interface GenderGroupEntry {
  studyType: string;
  gender: Gender;
  count: number;
}

export interface StudiesOverTimeEntry {
  period: string;
  count: number;
}

export interface NoOrderRate {
  total: number;
  noOrder: number;
  rate: number;
}

export interface CompletionRate {
  total: number;
  withResults: number;
  rate: number;
}

export interface NationalityDistributionEntry {
  nationality: string;
  count: number;
}

export interface StatsResult {
  studyTypeCounts: StudyTypeCount[];
  ageGroups: AgeGroupEntry[];
  genderGroups: GenderGroupEntry[];
  studiesOverTime: StudiesOverTimeEntry[];
  noOrderRate: NoOrderRate;
  avgStudiesPerPatient: number;
  completionRate: CompletionRate;
  nationalityDistribution: NationalityDistributionEntry[];
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
      ? 'AND s."organizationId" = :organizationId'
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

    const rangeDays = toDate.diff(fromDate, 'day');
    let trendGranularity: 'day' | 'week' | 'month' = 'day';
    if (rangeDays >= 365) {
      trendGranularity = 'month';
    } else if (rangeDays > 90) {
      trendGranularity = 'week';
    }
    const studiesOverTime = await sequelize.query<StudiesOverTimeEntry>(
      `
      SELECT DATE_TRUNC(:trendGranularity, s.date)::date::text AS period, COUNT(*)::int AS count
      FROM studies s
      WHERE s.date >= :from AND s.date <= :to
      ${orgFilter}
      GROUP BY period
      ORDER BY period ASC
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          ...replacements,
          trendGranularity,
        },
      }
    );

    const [noOrderRow] = await sequelize.query<{
      total: number;
      noOrder: number;
    }>(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s."noOrder" = true)::int AS "noOrder"
      FROM studies s
      WHERE s.date >= :from AND s.date <= :to
      ${orgFilter}
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const noOrderTotal = noOrderRow?.total || 0;
    const noOrderCount = noOrderRow?.noOrder || 0;
    const noOrderRate: NoOrderRate = {
      total: noOrderTotal,
      noOrder: noOrderCount,
      rate: noOrderTotal > 0 ? Number((noOrderCount / noOrderTotal).toFixed(4)) : 0,
    };

    const [avgStudiesRow] = await sequelize.query<{
      average: number | null;
    }>(
      `
      SELECT AVG(patient_counts.cnt)::float AS average
      FROM (
        SELECT s."patientId", COUNT(*)::int AS cnt
        FROM studies s
        WHERE s.date >= :from AND s.date <= :to
        ${orgFilter}
        GROUP BY s."patientId"
      ) patient_counts
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const avgStudiesPerPatient = avgStudiesRow?.average
      ? Number(avgStudiesRow.average.toFixed(2))
      : 0;

    const [completionRow] = await sequelize.query<{
      total: number;
      withResults: number;
    }>(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM study_results sr
            WHERE sr."studyId" = s.id
          )
        )::int AS "withResults"
      FROM studies s
      WHERE s.date >= :from AND s.date <= :to
      ${orgFilter}
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const completionTotal = completionRow?.total || 0;
    const completionWithResults = completionRow?.withResults || 0;
    const completionRate: CompletionRate = {
      total: completionTotal,
      withResults: completionWithResults,
      rate: completionTotal > 0
        ? Number((completionWithResults / completionTotal).toFixed(4))
        : 0,
    };

    const nationalityDistribution = await sequelize.query<NationalityDistributionEntry>(
      `
      WITH patients_in_range AS (
        SELECT DISTINCT s."patientId"
        FROM studies s
        WHERE s.date >= :from AND s.date <= :to
        ${orgFilter}
      )
      SELECT pd.nationality AS nationality, COUNT(DISTINCT pir."patientId")::int AS count
      FROM patients_in_range pir
      JOIN patient_personal_data ppd ON ppd."ownerId" = pir."patientId"
      JOIN personal_data pd ON pd.id = ppd."personalDataId"
      WHERE pd.nationality IS NOT NULL
      GROUP BY pd.nationality
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
      return {
        studyTypeCounts,
        ageGroups: [],
        genderGroups: [],
        studiesOverTime,
        noOrderRate,
        avgStudiesPerPatient,
        completionRate,
        nationalityDistribution,
      };
    }

    const patientIds = [...new Set(patientStudyRows.map(r => r.patientId))];

    const birthRows = await sequelize.query<{
      ownerId: string;
      birthDate: string | null;
      gender: Gender | null;
    }>(
      `
      SELECT ppd."ownerId", pd."birthDate", pd.gender
      FROM patient_personal_data ppd
      JOIN personal_data pd ON pd.id = ppd."personalDataId"
      WHERE ppd."ownerId" IN (:patientIds)
      `,
      { type: QueryTypes.SELECT, replacements: { patientIds } }
    );

    const birthByPatient = new Map<string, string | null>();
    const genderByPatient = new Map<string, Gender | null>();
    for (const row of birthRows) {
      if (row.birthDate) {
        const decrypted = decryptValue(row.birthDate);
        birthByPatient.set(row.ownerId, decrypted);
      }
      genderByPatient.set(row.ownerId, row.gender);
    }

    const bucketMap = new Map<string, Map<AgeBucket, number>>();
    const genderMap = new Map<string, Map<Gender, number>>();

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

      const gender = genderByPatient.get(patientId);
      if (gender) {
        if (!genderMap.has(studyType)) {
          genderMap.set(studyType, new Map());
        }
        const typeGenders = genderMap.get(studyType)!;
        typeGenders.set(gender, (typeGenders.get(gender) || 0) + 1);
      }
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

    const genderGroups: GenderGroupEntry[] = [];
    for (const [studyType, genders] of genderMap) {
      for (const gender of ['male', 'female', 'other'] as const) {
        const count = genders.get(gender) || 0;
        if (count > 0) {
          genderGroups.push({ studyType, gender, count });
        }
      }
    }

    return {
      studyTypeCounts,
      ageGroups,
      genderGroups,
      studiesOverTime,
      noOrderRate,
      avgStudiesPerPatient,
      completionRate,
      nationalityDistribution,
    };
  }
}
