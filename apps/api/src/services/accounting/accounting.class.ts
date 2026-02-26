import { Sequelize, QueryTypes } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import dayjs from 'dayjs';

import type { Application } from '../../declarations';

export interface AccountingRecord {
  id: string;
  date: string;
  kind: string;
  protocol: number | null;
  medicId: string | null;
  insurerId: string | null;
  insurerName: string;
  patientName: string;
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
  kind: string;
  protocol: number | null;
  medicId: string | null;
  insurerId: string | null;
  insurerName: string;
  patientFirstName: string | null;
  patientLastName: string | null;
}

type PricingType = 'fixed' | 'multiplier';

interface PricingConfig {
  type: PricingType;
  value?: number;
  baseValue?: number;
  multiplier?: number;
  baseName?: string;
  code?: string;
}

type InsurerPricing = Record<string, number | PricingConfig>;
type InsurerPrices = Record<string, InsurerPricing>;

interface SettingsRow {
  userId: string;
  insurerPrices: unknown;
}

function toNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function toInsurerPrices(value: unknown): InsurerPrices {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: InsurerPrices = {};
  for (const [insurerId, insurerValue] of Object.entries(value as Record<string, unknown>)) {
    if (!insurerId || !insurerValue || typeof insurerValue !== 'object' || Array.isArray(insurerValue)) {
      continue;
    }
    result[insurerId] = insurerValue as InsurerPricing;
  }

  return result;
}

function resolveCostFromPrice(price: number | PricingConfig | undefined): number {
  if (price == null) {
    return 0;
  }
  if (typeof price === 'number') {
    return toNonNegativeNumber(price);
  }
  if (!price || typeof price !== 'object' || Array.isArray(price)) {
    return 0;
  }

  if (price.type === 'multiplier') {
    const baseValue = toNonNegativeNumber(price.baseValue);
    const multiplier = toNonNegativeNumber(price.multiplier);
    return baseValue * multiplier;
  }

  return toNonNegativeNumber(price.value);
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

    const insurerFilter = insurerId
      ? 'WHERE COALESCE(t."insurerId", pat."medicareId") = :insurerId'
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

    const rows = await sequelize.query<RawRow>(
      `
      SELECT
        t.id,
        t.date::text AS date,
        t.kind,
        t.protocol,
        t."medicId",
        COALESCE(t."insurerId", pat."medicareId") AS "insurerId",
        COALESCE(prp."shortName", 'Particular') AS "insurerName",
        pd."firstName" AS "patientFirstName",
        pd."lastName" AS "patientLastName"
      FROM (
        SELECT
          e.id,
          e.date,
          'encounter'::text AS kind,
          NULL::int AS protocol,
          e."insurerId",
          e."patientId",
          e."medicId",
          e."organizationId"
        FROM encounters e
        WHERE e.date >= :from AND e.date <= :to
          ${orgFilterE}

        UNION ALL

        SELECT
          s.id,
          s.date,
          UNNEST(s.studies)::text AS kind,
          s.protocol,
          s."insurerId",
          s."patientId",
          s."medicId",
          s."organizationId"
        FROM studies s
        WHERE s.date >= :from AND s.date <= :to
          ${orgFilterS}
      ) t
      LEFT JOIN patients pat ON pat.id = t."patientId"
      LEFT JOIN prepagas prp ON prp.id = COALESCE(t."insurerId", pat."medicareId")
      LEFT JOIN patient_personal_data ppd ON ppd."ownerId" = pat.id
      LEFT JOIN personal_data pd ON pd.id = ppd."personalDataId"
      ${insurerFilter}
      ORDER BY t.date DESC, t.kind ASC
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const medicIds = [
      ...new Set(
        rows
          .map((row) => row.medicId)
          .filter((medicId): medicId is string => Boolean(medicId))
      ),
    ];
    const settingsRows = medicIds.length
      ? await sequelize.query<SettingsRow>(
        'SELECT "userId", "insurerPrices" FROM md_settings WHERE "userId" IN (:medicIds)',
        { type: QueryTypes.SELECT, replacements: { medicIds } }
      )
      : [];
    const insurerPricesByMedicId = new Map<string, InsurerPrices>(
      settingsRows.map((row) => [row.userId, toInsurerPrices(row.insurerPrices)])
    );

    const records: AccountingRecord[] = rows.map(row => {
      const firstName = row.patientFirstName || '';
      const lastName = row.patientLastName || '';
      const patientName = `${firstName} ${lastName}`.trim() || '-';
      const medicPrices = row.medicId ? insurerPricesByMedicId.get(row.medicId) : undefined;
      const insurerPracticePrices = row.insurerId && medicPrices ? medicPrices[row.insurerId] : undefined;
      const practicePrice = insurerPracticePrices ? insurerPracticePrices[row.kind] : undefined;
      const cost = resolveCostFromPrice(practicePrice);

      return {
        id: row.id,
        date: row.date,
        kind: row.kind,
        protocol: row.protocol,
        medicId: row.medicId,
        insurerId: row.insurerId,
        insurerName: row.insurerName,
        patientName,
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
