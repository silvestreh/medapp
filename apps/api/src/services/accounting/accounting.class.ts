import { Op, Sequelize } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Params, Id } from '@feathersjs/feathers';
import dayjs from 'dayjs';

import { studySchemas, getExtraCostSections, type ExtraCostSection } from '@medapp/encounter-schemas';

import type {
  Application,
  PatientPersonalData,
  PersonalData,
  Prepaga,
  MdSettings,
} from '../../declarations';

const extraCostSectionsByStudyType = new Map<string, ExtraCostSection[]>();
for (const [studyName, schema] of Object.entries(studySchemas)) {
  const sections = getExtraCostSections(schema);
  if (sections.length > 0) {
    extraCostSectionsByStudyType.set(studyName, sections);
  }
}

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

type PricingType = 'fixed' | 'multiplier';

interface PricingConfig {
  type: PricingType;
  value?: number;
  baseValue?: number;
  multiplier?: number;
  baseName?: string;
  code?: string;
  extras?: Record<string, number>;
}

type InsurerPricing = Record<string, number | PricingConfig>;
type InsurerPrices = Record<string, InsurerPricing>;

const PARTICULAR_INSURER_ID = '_particular';

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

function resolveExtraCost(
  price: number | PricingConfig | undefined,
  activeSections: string[]
): number {
  if (price == null || typeof price === 'number' || !activeSections.length) {
    return 0;
  }
  const extras = price.extras;
  if (!extras) {
    return 0;
  }

  let total = 0;
  for (const section of activeSections) {
    const extraValue = extras[section];
    if (!extraValue) continue;

    if (price.type === 'multiplier') {
      total += toNonNegativeNumber(price.baseValue) * toNonNegativeNumber(extraValue);
    } else {
      total += toNonNegativeNumber(extraValue);
    }
  }

  return total;
}

function hasAnyFieldValue(
  data: Record<string, unknown>,
  fieldNames: string[]
): boolean {
  for (const name of fieldNames) {
    const val = data[name];
    if (val != null && val !== '') {
      return true;
    }
  }
  return false;
}

interface EncounterRow {
  id: string;
  date: Date | string;
  insurerId: string | null;
  patientId: string;
  medicId: string | null;
}

interface StudyRow {
  id: string;
  date: Date | string;
  studies: string[];
  protocol: number | null;
  insurerId: string | null;
  patientId: string;
  medicId: string | null;
}

function dateToString(d: Date | string): string {
  if (d instanceof Date) {
    return d.toISOString();
  }
  return String(d);
}

interface PatientRow {
  id: string;
  medicareId: string | null;
}

export class Accounting {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async get(id: Id, params?: Params): Promise<string[]> {
    if (id !== 'insurers') {
      throw new BadRequest(`Unknown resource: ${id}`);
    }

    const medicId = params?.query?.medicId;
    if (!medicId) {
      throw new BadRequest('medicId query param is required');
    }

    const sequelize: Sequelize = this.app.get('sequelizeClient');

    const encounterRows = await sequelize.models.encounters.findAll({
      where: { medicId },
      attributes: ['insurerId', 'patientId'],
      raw: true,
    }) as unknown as { insurerId: string | null; patientId: string }[];

    const studyRows = await sequelize.models.studies.findAll({
      where: { medicId },
      attributes: ['insurerId', 'patientId'],
      raw: true,
    }) as unknown as { insurerId: string | null; patientId: string }[];

    const allRows = [...encounterRows, ...studyRows];
    const patientIds = [...new Set(allRows.map(r => r.patientId).filter(Boolean))];

    const patients = patientIds.length
      ? await sequelize.models.patients.findAll({
        where: { id: { [Op.in]: patientIds } },
        attributes: ['id', 'medicareId'],
        raw: true,
      }) as unknown as PatientRow[]
      : [];

    const patientById = new Map(patients.map(p => [p.id, p]));

    const insurerIds = new Set<string>();
    for (const row of allRows) {
      const effectiveId = row.insurerId || patientById.get(row.patientId)?.medicareId;
      if (effectiveId) {
        insurerIds.add(effectiveId);
      }
    }

    return [...insurerIds];
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

    const fromISO = fromDate.startOf('day').toISOString();
    const toISO = toDate.endOf('day').toISOString();

    const dateFilter = { [Op.gte]: fromISO, [Op.lte]: toISO };

    const encounterWhere: Record<string, unknown> = { date: dateFilter };
    if (organizationId) encounterWhere.organizationId = organizationId;

    const studyWhere: Record<string, unknown> = { date: dateFilter };
    if (organizationId) studyWhere.organizationId = organizationId;

    const [encounterRows, studyRows] = await Promise.all([
      sequelize.models.encounters.findAll({
        where: encounterWhere,
        attributes: ['id', 'date', 'insurerId', 'patientId', 'medicId'],
        raw: true,
      }) as Promise<unknown> as Promise<EncounterRow[]>,
      sequelize.models.studies.findAll({
        where: studyWhere,
        attributes: ['id', 'date', 'studies', 'protocol', 'insurerId', 'patientId', 'medicId'],
        raw: true,
      }) as Promise<unknown> as Promise<StudyRow[]>,
    ]);

    const patientIds = [
      ...new Set([
        ...encounterRows.map(e => e.patientId),
        ...studyRows.map(s => s.patientId),
      ].filter(Boolean)),
    ];

    const patients = patientIds.length
      ? await sequelize.models.patients.findAll({
        where: { id: { [Op.in]: patientIds } },
        attributes: ['id', 'medicareId'],
        raw: true,
      }) as unknown as PatientRow[]
      : [];
    const patientById = new Map(patients.map(p => [p.id, p]));

    const [ppds, allInsurerIds] = await (async () => {
      const ppdRows = patientIds.length
        ? await this.app.service('patient-personal-data').find({
          query: { ownerId: { $in: patientIds } },
          paginate: false,
        }) as PatientPersonalData[]
        : [];

      const ids = new Set<string>();
      for (const e of encounterRows) {
        const effective = e.insurerId || patientById.get(e.patientId)?.medicareId;
        if (effective) ids.add(effective);
      }
      for (const s of studyRows) {
        const effective = s.insurerId || patientById.get(s.patientId)?.medicareId;
        if (effective) ids.add(effective);
      }

      return [ppdRows, [...ids]] as const;
    })();

    const pdIds = ppds.map(ppd => ppd.personalDataId as string);
    const [pds, prepagas] = await Promise.all([
      pdIds.length
        ? this.app.service('personal-data').find({
          query: { id: { $in: pdIds }, $select: ['id', 'firstName', 'lastName'] },
          paginate: false,
        }) as Promise<PersonalData[]>
        : Promise.resolve([] as PersonalData[]),
      allInsurerIds.length
        ? this.app.service('prepagas').find({
          query: { id: { $in: allInsurerIds } },
          paginate: false,
        }) as Promise<Prepaga[]>
        : Promise.resolve([] as Prepaga[]),
    ]);

    const pdById = new Map(pds.map(pd => [pd.id.toString(), pd]));
    const ppdByOwnerId = new Map(ppds.map(ppd => [ppd.ownerId.toString(), ppd]));
    const prepagaById = new Map(prepagas.map(p => [p.id.toString(), p]));

    interface RawRow {
      id: string;
      date: string;
      kind: string;
      protocol: number | null;
      medicId: string | null;
      insurerId: string | null;
      patientId: string;
    }

    const rawRows: RawRow[] = [];

    for (const e of encounterRows) {
      const effectiveInsurerId = e.insurerId || patientById.get(e.patientId)?.medicareId || null;
      if (insurerId && effectiveInsurerId !== insurerId) continue;
      rawRows.push({
        id: e.id,
        date: dateToString(e.date),
        kind: 'encounter',
        protocol: null,
        medicId: e.medicId,
        insurerId: effectiveInsurerId,
        patientId: e.patientId,
      });
    }

    for (const s of studyRows) {
      const effectiveInsurerId = s.insurerId || patientById.get(s.patientId)?.medicareId || null;
      if (insurerId && effectiveInsurerId !== insurerId) continue;
      for (const studyType of (s.studies || [])) {
        rawRows.push({
          id: s.id,
          date: dateToString(s.date),
          kind: studyType,
          protocol: s.protocol,
          medicId: s.medicId,
          insurerId: effectiveInsurerId,
          patientId: s.patientId,
        });
      }
    }

    rawRows.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.kind.localeCompare(b.kind);
    });

    const medicIds = [
      ...new Set(rawRows.map(r => r.medicId).filter((id): id is string => Boolean(id))),
    ];
    const settingsList = medicIds.length
      ? await this.app.service('md-settings').find({
        query: { userId: { $in: medicIds } },
        paginate: false,
      }) as MdSettings[]
      : [];
    const insurerPricesByMedicId = new Map<string, InsurerPrices>(
      settingsList.map(s => [s.userId as string, toInsurerPrices(s.insurerPrices)])
    );

    // Determine which studies need extra-cost section checks
    const studyIdsWithExtraCost = new Set<string>();
    for (const row of rawRows) {
      if (row.kind !== 'encounter' && extraCostSectionsByStudyType.has(row.kind)) {
        studyIdsWithExtraCost.add(row.id);
      }
    }

    // studyId+studyType -> active section names
    const activeExtrasByRow = new Map<string, string[]>();

    if (studyIdsWithExtraCost.size > 0) {
      const studyResultRows = await this.app.service('study-results').find({
        query: {
          studyId: { $in: [...studyIdsWithExtraCost] },
        },
        paginate: false,
      }) as { studyId: string; type: string; data: Record<string, unknown> }[];

      for (const result of studyResultRows) {
        const sections = extraCostSectionsByStudyType.get(result.type);
        if (!sections || !result.data) continue;

        const data = typeof result.data === 'string'
          ? JSON.parse(result.data)
          : result.data;

        const active: string[] = [];
        for (const section of sections) {
          if (hasAnyFieldValue(data, section.fieldNames)) {
            active.push(section.name);
          }
        }

        if (active.length > 0) {
          activeExtrasByRow.set(`${result.studyId}:${result.type}`, active);
        }
      }
    }

    const records: AccountingRecord[] = rawRows.map(row => {
      const ppd = ppdByOwnerId.get(row.patientId);
      const pd = ppd ? pdById.get(ppd.personalDataId.toString()) : null;
      const firstName = pd?.firstName || '';
      const lastName = pd?.lastName || '';
      const patientName = `${firstName} ${lastName}`.trim() || '-';

      const prepaga = row.insurerId ? prepagaById.get(row.insurerId) : null;
      const insurerName = prepaga?.shortName || 'Particular';

      const medicPrices = row.medicId ? insurerPricesByMedicId.get(row.medicId) : undefined;
      const priceKey = row.insurerId || PARTICULAR_INSURER_ID;
      const insurerPracticePrices = medicPrices ? medicPrices[priceKey] : undefined;
      const practicePrice = insurerPracticePrices ? insurerPracticePrices[row.kind] : undefined;
      const baseCost = resolveCostFromPrice(practicePrice);
      const activeSections = activeExtrasByRow.get(`${row.id}:${row.kind}`) ?? [];
      const extraCost = resolveExtraCost(practicePrice, activeSections);
      const cost = baseCost + extraCost;

      return {
        id: row.id,
        date: row.date,
        kind: row.kind,
        protocol: row.protocol,
        medicId: row.medicId,
        insurerId: row.insurerId,
        insurerName,
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
