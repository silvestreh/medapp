import { Sequelize, QueryTypes } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import dayjs from 'dayjs';

import type { Application } from '../../declarations';
import { decryptValue } from '../../hooks/encryption';

export interface AccountingRecord {
  id: string;
  date: string;
  kind: 'encounter' | 'study';
  studyType: string | null;
  protocol: number | null;
  insurerId: string | null;
  insurerName: string;
  patientName: string;
  patientInsurance: string;
  patientInsuranceNumber: string;
  cost: number;
}

export interface AccountingResult {
  records: AccountingRecord[];
  totalRevenue: number;
  revenueByDay: { date: string; revenue: number }[];
  revenueByInsurer: { insurer: string; revenue: number }[];
}

interface RawRow {
  id: string;
  date: string;
  kind: 'encounter' | 'study';
  studyType: string | null;
  protocol: number | null;
  insurerId: string | null;
  insurerName: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientInsurance: string | null;
  patientInsuranceNumber: string | null;
  cost: number;
}

export class Accounting {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params?: Params): Promise<AccountingResult> {
    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const organizationId = params?.organizationId;
    const query = params?.query || {};
    const { from, to, insurerId } = query;

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

    const orgFilterE = organizationId
      ? 'AND e."organizationId" = :organizationId'
      : '';

    const orgFilterS = organizationId
      ? 'AND s."organizationId" = :organizationId'
      : '';

    const insurerFilterE = insurerId
      ? 'AND e."insurerId" = :insurerId'
      : '';

    const insurerFilterS = insurerId
      ? 'AND s."insurerId" = :insurerId'
      : '';

    const replacements: Record<string, string> = {
      from: fromDate.startOf('day').toISOString(),
      to: toDate.endOf('day').toISOString(),
    };

    if (organizationId) {
      replacements.organizationId = organizationId;
    }
    if (insurerId) {
      replacements.insurerId = insurerId;
    }

    const userId = params?.user?.id;
    let insurerPrices: Record<string, Record<string, number>> = {};

    if (userId) {
      const settingsRows = await sequelize.query<{ insurerPrices: unknown }>(
        `SELECT "insurerPrices" FROM md_settings WHERE "userId" = :userId LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { userId } }
      );
      const raw = settingsRows[0]?.insurerPrices;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        insurerPrices = raw as Record<string, Record<string, number>>;
      }
    }

    const rows = await sequelize.query<RawRow>(
      `
      SELECT
        t.id,
        t.date::text AS date,
        t.kind,
        t."studyType",
        t.protocol,
        t."insurerId",
        COALESCE(
          prp."shortName" || ' / ' || prp.denomination,
          pat.medicare,
          '-'
        ) AS "insurerName",
        pd."firstName" AS "patientFirstName",
        pd."lastName" AS "patientLastName",
        pat.medicare AS "patientInsurance",
        pat."medicareNumber" AS "patientInsuranceNumber",
        t.cost
      FROM (
        SELECT
          e.id,
          e.date,
          'encounter'::text AS kind,
          NULL::text AS "studyType",
          NULL::int AS protocol,
          e."insurerId",
          e."patientId",
          e."organizationId",
          COALESCE(e.cost, 0)::numeric AS cost
        FROM encounters e
        WHERE e.date >= :from AND e.date <= :to
          ${orgFilterE}
          ${insurerFilterE}

        UNION ALL

        SELECT
          s.id,
          s.date,
          'study'::text AS kind,
          UNNEST(s.studies) AS "studyType",
          s.protocol,
          s."insurerId",
          s."patientId",
          s."organizationId",
          0::numeric AS cost
        FROM studies s
        WHERE s.date >= :from AND s.date <= :to
          ${orgFilterS}
          ${insurerFilterS}
      ) t
      LEFT JOIN patients pat ON pat.id = t."patientId"
      LEFT JOIN prepagas prp ON prp.id = t."insurerId"
      LEFT JOIN patient_personal_data ppd ON ppd."ownerId" = pat.id
      LEFT JOIN personal_data pd ON pd.id = ppd."personalDataId"
      ORDER BY t.date DESC, t.kind ASC
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const records: AccountingRecord[] = rows.map(row => {
      const firstName = row.patientFirstName || '';
      const lastName = row.patientLastName || '';
      const patientName = `${firstName} ${lastName}`.trim() || '-';

      let decryptedInsuranceNumber = '-';
      if (row.patientInsuranceNumber) {
        try {
          decryptedInsuranceNumber = decryptValue(row.patientInsuranceNumber) || '-';
        } catch {
          decryptedInsuranceNumber = row.patientInsuranceNumber;
        }
      }

      let cost = Number(row.cost) || 0;
      if (row.kind === 'study' && row.studyType && row.insurerId) {
        const priceMap = insurerPrices[row.insurerId];
        if (priceMap && priceMap[row.studyType] != null) {
          cost = Number(priceMap[row.studyType]) || 0;
        }
      }

      return {
        id: row.id,
        date: row.date,
        kind: row.kind,
        studyType: row.studyType,
        protocol: row.protocol,
        insurerId: row.insurerId,
        insurerName: row.insurerName,
        patientName,
        patientInsurance: row.patientInsurance || '-',
        patientInsuranceNumber: decryptedInsuranceNumber,
        cost: Number(cost.toFixed(2)),
      };
    });

    let totalRevenue = 0;
    const byDay = new Map<string, number>();
    const byInsurer = new Map<string, number>();

    for (const record of records) {
      totalRevenue += record.cost;

      const dayKey = record.date.slice(0, 10);
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + record.cost);

      const insurerKey = record.insurerName;
      byInsurer.set(insurerKey, (byInsurer.get(insurerKey) || 0) + record.cost);
    }

    const revenueByDay = [...byDay.entries()]
      .map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const revenueByInsurer = [...byInsurer.entries()]
      .map(([insurer, revenue]) => ({ insurer, revenue: Number(revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      records,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      revenueByDay,
      revenueByInsurer,
    };
  }
}
