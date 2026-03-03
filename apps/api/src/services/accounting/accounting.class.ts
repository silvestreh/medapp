import { Op, Sequelize } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Params, Id } from '@feathersjs/feathers';
import dayjs from 'dayjs';

import type {
  Application,
  PatientPersonalData,
  PersonalData,
  Prepaga,
  PracticeCost,
  AccountingSettings,
} from '../../declarations';
import {
  toInsurerPrices,
  resolveTotalCost,
  PARTICULAR_INSURER_ID,
  extraCostSectionsByStudyType,
  hasAnyFieldValue,
} from '../../utils/cost-resolution';

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

function dateToString(d: Date | string): string {
  if (d instanceof Date) {
    return d.toISOString();
  }
  return String(d);
}

export class Accounting {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async get(id: Id, params?: Params): Promise<unknown> {
    const medicId = params?.query?.medicId;
    if (!medicId) {
      throw new BadRequest('medicId query param is required');
    }

    const sequelize: Sequelize = this.app.get('sequelizeClient');

    if (id === 'insurers') {
      const rows = await sequelize.models.practice_costs.findAll({
        where: { medicId },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('insurerId')), 'insurerId']],
        raw: true,
      }) as unknown as { insurerId: string | null }[];

      return rows
        .map(r => r.insurerId)
        .filter((v): v is string => Boolean(v));
    }

    if (id === 'all-insurers') {
      const [rows] = await sequelize.query(`
        SELECT DISTINCT "insurerId" FROM studies WHERE "medicId" = :medicId AND "insurerId" IS NOT NULL
        UNION
        SELECT DISTINCT "insurerId" FROM encounters WHERE "medicId" = :medicId AND "insurerId" IS NOT NULL
        UNION
        SELECT DISTINCT "insurerId" FROM practice_costs WHERE "medicId" = :medicId AND "insurerId" IS NOT NULL
      `, { replacements: { medicId } }) as [{ insurerId: string }[], unknown];

      return rows.map(r => r.insurerId).filter(Boolean);
    }

    if (id === 'uncosted') {
      const { from, to, insurerId: filterInsurerId } = params?.query || {};
      if (!from || !to) {
        throw new BadRequest('Both "from" and "to" query params are required');
      }

      const fromDate = dayjs(from);
      const toDate = dayjs(to);
      if (!fromDate.isValid() || !toDate.isValid()) {
        throw new BadRequest('"from" and "to" must be valid dates');
      }

      const fromISO = fromDate.startOf('day').toISOString();
      const toISO = toDate.endOf('day').toISOString();

      // Studies without cost rows
      const uncostsedStudies = await sequelize.models.studies.findAll({
        where: {
          medicId,
          date: { [Op.gte]: fromISO, [Op.lte]: toISO },
        },
        attributes: ['id', 'date', 'patientId', 'insurerId', 'emergency', 'studies', 'organizationId', 'medicId'],
        raw: true,
      }) as unknown as {
        id: string; date: string; patientId: string; insurerId: string | null;
        emergency: boolean; studies: string[]; organizationId: string; medicId: string;
      }[];

      // Encounters without cost rows
      const uncostedEncounters = await sequelize.models.encounters.findAll({
        where: {
          medicId,
          date: { [Op.gte]: fromISO, [Op.lte]: toISO },
        },
        attributes: ['id', 'date', 'patientId', 'insurerId', 'organizationId', 'medicId'],
        raw: true,
      }) as unknown as {
        id: string; date: string; patientId: string; insurerId: string | null;
        organizationId: string; medicId: string;
      }[];

      // Get all practice_costs practiceIds in that range to filter out already costed
      const existingCosts = await sequelize.models.practice_costs.findAll({
        where: {
          medicId,
          date: { [Op.gte]: fromISO, [Op.lte]: toISO },
        },
        attributes: ['practiceId'],
        raw: true,
      }) as unknown as { practiceId: string }[];

      const costedIds = new Set(existingCosts.map(r => r.practiceId));

      const uncostedStudyRows = uncostsedStudies.filter(s => !costedIds.has(s.id));
      const uncostedEncounterRows = uncostedEncounters.filter(e => !costedIds.has(e.id));

      // Filter to only practices whose effective insurer has pricing configured
      const insurerPrices = await this.getMedicInsurerPrices(medicId);
      const configuredInsurers = new Set(Object.keys(insurerPrices));

      const resolveAndFilter = async <T extends { insurerId: string | null; patientId: string }>(
        rows: T[],
      ): Promise<(T & { effectiveInsurerId: string })[]> => {
        const results: (T & { effectiveInsurerId: string })[] = [];
        for (const row of rows) {
          const resolved = await this.resolveEffectiveInsurerId(row.insurerId, row.patientId);
          const priceKey = resolved || PARTICULAR_INSURER_ID;
          if (!configuredInsurers.has(priceKey)) continue;
          if (filterInsurerId && priceKey !== filterInsurerId) continue;
          results.push({ ...row, effectiveInsurerId: priceKey });
        }
        return results;
      };

      const filteredStudyRows = await resolveAndFilter(uncostedStudyRows);
      const filteredEncounterRows = await resolveAndFilter(uncostedEncounterRows);

      // Enrich with patient names
      const allPatientIds = [
        ...new Set([
          ...filteredStudyRows.map(s => s.patientId),
          ...filteredEncounterRows.map(e => e.patientId),
        ]),
      ];

      const ppds = allPatientIds.length
        ? await this.app.service('patient-personal-data').find({
          query: { ownerId: { $in: allPatientIds } },
          paginate: false,
        }) as PatientPersonalData[]
        : [];

      const pdIds = ppds.map(ppd => ppd.personalDataId as string);
      const pds = pdIds.length
        ? await this.app.service('personal-data').find({
          query: { id: { $in: pdIds }, $select: ['id', 'firstName', 'lastName'] },
          paginate: false,
        }) as PersonalData[]
        : [];

      const pdById = new Map(pds.map(pd => [pd.id.toString(), pd]));
      const ppdByOwnerId = new Map(ppds.map(ppd => [ppd.ownerId.toString(), ppd]));

      const getPatientName = (patientId: string): string => {
        const ppd = ppdByOwnerId.get(patientId);
        const pd = ppd ? pdById.get(ppd.personalDataId.toString()) : null;
        const first = pd?.firstName || '';
        const last = pd?.lastName || '';
        return `${first} ${last}`.trim() || '-';
      };

      const results = [
        ...filteredStudyRows.map(s => ({
          practiceId: s.id,
          practiceType: 'studies' as const,
          date: s.date,
          patientId: s.patientId,
          insurerId: s.insurerId,
          effectiveInsurerId: s.effectiveInsurerId,
          emergency: s.emergency,
          studies: s.studies,
          patientName: getPatientName(s.patientId),
        })),
        ...filteredEncounterRows.map(e => ({
          practiceId: e.id,
          practiceType: 'encounters' as const,
          date: e.date,
          patientId: e.patientId,
          insurerId: e.insurerId,
          effectiveInsurerId: e.effectiveInsurerId,
          emergency: false,
          patientName: getPatientName(e.patientId),
        })),
      ];

      results.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      return results;
    }

    throw new BadRequest(`Unknown resource: ${id}`);
  }

  async find(params?: Params): Promise<AccountingResult> {
    const organizationId = params?.organizationId;
    const query = params?.query || {};
    const { from, to, insurerId, medicId } = query;

    if (!from || !to) {
      throw new BadRequest('Both "from" and "to" query params are required');
    }

    if (!medicId) {
      throw new BadRequest('medicId query param is required');
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

    // Query practice_costs
    const where: Record<string, unknown> = {
      medicId,
      date: { [Op.gte]: fromISO, [Op.lte]: toISO },
    };
    if (organizationId) where.organizationId = organizationId;
    if (insurerId) where.insurerId = insurerId;

    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const costRows = await sequelize.models.practice_costs.findAll({
      where,
      raw: true,
    }) as unknown as PracticeCost[];

    // Collect unique patient and insurer IDs for display lookups
    const patientIds = [...new Set(costRows.map(r => String(r.patientId)).filter(Boolean))];
    const allInsurerIds = [...new Set(costRows.map(r => String(r.insurerId)).filter(id => id && id !== 'null'))];

    // Collect study practiceIds to fetch protocol numbers
    const studyPracticeIds = [
      ...new Set(
        costRows
          .filter(r => r.practiceType === 'studies')
          .map(r => String(r.practiceId))
      ),
    ];

    // Bulk fetch patient names, insurers, and study protocols
    const [ppds, prepagas, studyRows] = await Promise.all([
      patientIds.length
        ? this.app.service('patient-personal-data').find({
          query: { ownerId: { $in: patientIds } },
          paginate: false,
        }) as Promise<PatientPersonalData[]>
        : Promise.resolve([] as PatientPersonalData[]),
      allInsurerIds.length
        ? this.app.service('prepagas').find({
          query: { id: { $in: allInsurerIds } },
          paginate: false,
        }) as Promise<Prepaga[]>
        : Promise.resolve([] as Prepaga[]),
      studyPracticeIds.length
        ? sequelize.models.studies.findAll({
          where: { id: { [Op.in]: studyPracticeIds } },
          attributes: ['id', 'protocol'],
          raw: true,
        }) as Promise<unknown> as Promise<{ id: string; protocol: number | null }[]>
        : Promise.resolve([] as { id: string; protocol: number | null }[]),
    ]);

    const pdIds = ppds.map(ppd => ppd.personalDataId as string);
    const pds = pdIds.length
      ? await this.app.service('personal-data').find({
        query: { id: { $in: pdIds }, $select: ['id', 'firstName', 'lastName'] },
        paginate: false,
      }) as PersonalData[]
      : [];

    const pdById = new Map(pds.map(pd => [pd.id.toString(), pd]));
    const ppdByOwnerId = new Map(ppds.map(ppd => [ppd.ownerId.toString(), ppd]));
    const prepagaById = new Map(prepagas.map(p => [p.id.toString(), p]));
    const protocolByStudyId = new Map(studyRows.map(s => [s.id, s.protocol]));

    // Build records
    const records: AccountingRecord[] = costRows.map(row => {
      const ppd = ppdByOwnerId.get(String(row.patientId));
      const pd = ppd ? pdById.get(ppd.personalDataId.toString()) : null;
      const firstName = pd?.firstName || '';
      const lastName = pd?.lastName || '';
      const patientName = `${firstName} ${lastName}`.trim() || '-';

      const prepaga = row.insurerId ? prepagaById.get(String(row.insurerId)) : null;
      const insurerName = prepaga?.shortName || 'Particular';

      const kind = row.studyType || 'encounter';
      const protocol = row.practiceType === 'studies'
        ? (protocolByStudyId.get(String(row.practiceId)) ?? null)
        : null;

      return {
        id: String(row.practiceId),
        date: dateToString(row.date as unknown as Date | string),
        kind,
        protocol,
        medicId: row.medicId as string | null,
        insurerId: row.insurerId as string | null,
        insurerName,
        patientName,
        cost: Number(Number(row.cost).toFixed(2)),
      };
    });

    records.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.kind.localeCompare(b.kind);
    });

    // Aggregations
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(
    data: { intent: string; practiceIds: { id: string; practiceType: 'studies' | 'encounters' }[] },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params?: Params,
  ): Promise<{ backfilled: number; skipped: number; errors: string[] }> {
    if (data.intent !== 'backfill') {
      throw new BadRequest(`Unknown intent: ${data.intent}`);
    }

    if (!Array.isArray(data.practiceIds) || data.practiceIds.length === 0) {
      throw new BadRequest('practiceIds array is required');
    }

    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const errors: string[] = [];
    let backfilled = 0;
    let skipped = 0;

    // Group by practiceType
    const studyIds = data.practiceIds.filter(p => p.practiceType === 'studies').map(p => p.id);
    const encounterIds = data.practiceIds.filter(p => p.practiceType === 'encounters').map(p => p.id);

    // Process studies
    if (studyIds.length > 0) {
      const studies = await sequelize.models.studies.findAll({
        where: { id: { [Op.in]: studyIds } },
        raw: true,
      }) as unknown as {
        id: string; date: string; patientId: string; insurerId: string | null;
        emergency: boolean; studies: string[]; organizationId: string; medicId: string;
      }[];

      for (const study of studies) {
        if (!study.medicId) { skipped++; continue; }

        const insurerPrices = await this.getMedicInsurerPrices(study.medicId);
        const effectiveInsurerId = await this.resolveEffectiveInsurerId(study.insurerId, study.patientId);
        const priceKey = effectiveInsurerId || PARTICULAR_INSURER_ID;
        const insurerPricing = insurerPrices[priceKey];
        const isEmergency = !!study.emergency;
        const studyTypes: string[] = study.studies || [];

        if (!insurerPricing) {
          skipped++; continue;
        }

        // Fetch study results for extra cost sections
        const studyResults = await this.app.service('study-results').find({
          query: { studyId: study.id },
          paginate: false,
        }) as { type: string; data: Record<string, unknown> | string }[];

        const resultsByType = new Map<string, Record<string, unknown>>();
        for (const sr of studyResults) {
          const d = typeof sr.data === 'string' ? JSON.parse(sr.data) : sr.data;
          resultsByType.set(sr.type, d || {});
        }

        for (const studyType of studyTypes) {
          const activeSections: string[] = [];
          const extraSections = extraCostSectionsByStudyType.get(studyType);
          if (extraSections) {
            const resultData = resultsByType.get(studyType);
            if (resultData) {
              for (const section of extraSections) {
                if (hasAnyFieldValue(resultData, section.fieldNames)) {
                  activeSections.push(section.name);
                }
              }
            }
          }

          const cost = resolveTotalCost({
            insurerPricing,
            practiceType: studyType,
            emergency: isEmergency,
            activeSections,
          });

          try {
            await this.app.service('practice-costs').create({
              organizationId: study.organizationId || null,
              medicId: study.medicId,
              patientId: study.patientId,
              practiceId: study.id,
              practiceType: 'studies',
              studyType,
              insurerId: effectiveInsurerId,
              emergency: isEmergency,
              date: new Date(study.date),
              cost,
            } as any, { provider: undefined });
            backfilled++;
          } catch (err: any) {
            console.warn(`[accounting:backfill] skip study ${study.id}/${studyType}: ${err.message}`);
            if (errors.length < 5) errors.push(`study ${study.id}/${studyType}: ${err.message}`);
            skipped++;
          }
        }
      }
    }

    // Process encounters
    if (encounterIds.length > 0) {
      const encounters = await sequelize.models.encounters.findAll({
        where: { id: { [Op.in]: encounterIds } },
        raw: true,
      }) as unknown as {
        id: string; date: string; patientId: string; insurerId: string | null;
        organizationId: string; medicId: string;
      }[];

      for (const encounter of encounters) {
        if (!encounter.medicId) { skipped++; continue; }

        const insurerPrices = await this.getMedicInsurerPrices(encounter.medicId);
        const effectiveInsurerId = await this.resolveEffectiveInsurerId(encounter.insurerId, encounter.patientId);
        const priceKey = effectiveInsurerId || PARTICULAR_INSURER_ID;
        const insurerPricing = insurerPrices[priceKey];
        if (!insurerPricing) { skipped++; continue; }

        const cost = resolveTotalCost({
          insurerPricing,
          practiceType: 'encounter',
          emergency: false,
          activeSections: [],
        });

        try {
          await this.app.service('practice-costs').create({
            organizationId: encounter.organizationId || null,
            medicId: encounter.medicId,
            patientId: encounter.patientId,
            practiceId: encounter.id,
            practiceType: 'encounters',
            studyType: null,
            insurerId: effectiveInsurerId,
            emergency: false,
            date: new Date(encounter.date),
            cost,
          } as any, { provider: undefined });
          backfilled++;
        } catch (err: any) {
          console.warn(`[accounting:backfill] skip encounter ${encounter.id}: ${err.message}`);
          if (errors.length < 5) errors.push(`encounter ${encounter.id}: ${err.message}`);
          skipped++;
        }
      }
    }

    return { backfilled, skipped, errors };
  }

  private async getMedicInsurerPrices(medicId: string) {
    const settings = await this.app.service('accounting-settings').find({
      query: { userId: medicId, $limit: 1 },
      paginate: false,
    }) as AccountingSettings[];

    if (settings.length === 0) return {};
    return toInsurerPrices(settings[0].insurerPrices);
  }

  private async resolveEffectiveInsurerId(
    insurerId: string | null,
    patientId: string,
  ): Promise<string | null> {
    if (insurerId) return insurerId;

    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const patient = await sequelize.models.patients.findByPk(patientId, {
      attributes: ['medicareId'],
      raw: true,
    }) as { medicareId: string | null } | null;

    return patient?.medicareId || null;
  }
}
