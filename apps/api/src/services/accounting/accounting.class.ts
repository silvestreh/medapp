import { BadRequest, NotFound } from '@feathersjs/errors';
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
  hasStudyResultData,
} from '../../utils/cost-resolution';

export interface AccountingRecord {
  id: string;
  practiceCostId: string;
  date: string;
  kind: string;
  protocol: number | null;
  medicId: string | null;
  insurerId: string | null;
  insurerName: string;
  patientName: string;
  cost: number;
  billedAt: string | null;
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

    if (id === 'insurers') {
      const costs = await this.app.service('practice-costs').find({
        query: { medicId, $select: ['insurerId'] },
        paginate: false,
      }) as PracticeCost[];

      return [...new Set(
        costs.map(r => r.insurerId as string | null).filter((v): v is string => Boolean(v))
      )];
    }

    if (id === 'all-insurers') {
      const [studyRows, encounterRows, costRows] = await Promise.all([
        this.app.service('studies').find({
          query: { medicId, insurerId: { $ne: null }, $select: ['insurerId'] },
          paginate: false,
        }) as Promise<{ insurerId: string }[]>,
        this.app.service('encounters').find({
          query: { medicId, insurerId: { $ne: null }, $select: ['insurerId'] },
          paginate: false,
        }) as Promise<{ insurerId: string }[]>,
        this.app.service('practice-costs').find({
          query: { medicId, insurerId: { $ne: null }, $select: ['insurerId'] },
          paginate: false,
        }) as Promise<PracticeCost[]>,
      ]);

      const allIds = [
        ...studyRows.map(r => r.insurerId),
        ...encounterRows.map(r => r.insurerId),
        ...costRows.map(r => r.insurerId as string),
      ];
      return [...new Set(allIds.filter(Boolean))];
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

      const [allStudies, allEncounters, existingCosts] = await Promise.all([
        this.app.service('studies').find({
          query: {
            medicId,
            date: { $gte: fromISO, $lte: toISO },
            $select: ['id', 'date', 'patientId', 'insurerId', 'emergency', 'studies', 'organizationId', 'medicId'],
          },
          paginate: false,
        }) as Promise<unknown> as Promise<{
          id: string; date: string; patientId: string; insurerId: string | null;
          emergency: boolean; studies: string[]; organizationId: string; medicId: string;
        }[]>,
        this.app.service('encounters').find({
          query: {
            medicId,
            date: { $gte: fromISO, $lte: toISO },
            $select: ['id', 'date', 'patientId', 'insurerId', 'organizationId', 'medicId'],
          },
          paginate: false,
        }) as Promise<unknown> as Promise<{
          id: string; date: string; patientId: string; insurerId: string | null;
          organizationId: string; medicId: string;
        }[]>,
        this.app.service('practice-costs').find({
          query: {
            medicId,
            date: { $gte: fromISO, $lte: toISO },
            $select: ['practiceId'],
          },
          paginate: false,
        }) as Promise<PracticeCost[]>,
      ]);

      const costedIds = new Set(existingCosts.map(r => r.practiceId as string));

      const uncostedStudyRows = allStudies.filter(s => !costedIds.has(s.id));
      const uncostedEncounterRows = allEncounters.filter(e => !costedIds.has(e.id));

      // Filter out studies with no meaningful results
      const studyIdsWithResults = await this.getStudyIdsWithResults(
        uncostedStudyRows.map(s => s.id)
      );
      const uncostedStudiesWithResults = uncostedStudyRows.filter(s =>
        studyIdsWithResults.has(s.id)
      );

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

      const filteredStudyRows = await resolveAndFilter(uncostedStudiesWithResults);
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
    const costQuery: Record<string, unknown> = {
      medicId,
      date: { $gte: fromISO, $lte: toISO },
    };
    if (organizationId) costQuery.organizationId = organizationId;
    if (insurerId) costQuery.insurerId = insurerId;

    const allCostRows = await this.app.service('practice-costs').find({
      query: costQuery,
      paginate: false,
    }) as PracticeCost[];

    // Collect study practiceIds to check for results
    const studyPracticeIds = [
      ...new Set(
        allCostRows
          .filter(r => r.practiceType === 'studies')
          .map(r => String(r.practiceId))
      ),
    ];

    // Collect unique patient and insurer IDs for display lookups
    const patientIds = [...new Set(allCostRows.map(r => String(r.patientId)).filter(Boolean))];
    const allInsurerIds = [...new Set(allCostRows.map(r => String(r.insurerId)).filter(id => id && id !== 'null'))];

    // Bulk fetch patient names, insurers, study protocols, and study results
    const [ppds, prepagas, studyRows, studyIdsWithResults] = await Promise.all([
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
        ? this.app.service('studies').find({
          query: { id: { $in: studyPracticeIds }, $select: ['id', 'protocol'] },
          paginate: false,
        }) as Promise<{ id: string; protocol: number | null }[]>
        : Promise.resolve([] as { id: string; protocol: number | null }[]),
      this.getStudyIdsWithResults(studyPracticeIds),
    ]);

    // Filter out study costs where the study has no meaningful results
    const costRows = allCostRows.filter(row => {
      if (row.practiceType !== 'studies') return true;
      return studyIdsWithResults.has(String(row.practiceId));
    });

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
        practiceCostId: String(row.id),
        date: dateToString(row.date as unknown as Date | string),
        kind,
        protocol,
        medicId: row.medicId as string | null,
        insurerId: row.insurerId as string | null,
        insurerName,
        patientName,
        cost: Number(Number(row.cost).toFixed(2)),
        billedAt: row.billedAt ? dateToString(row.billedAt as unknown as Date | string) : null,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(data: any, _params?: Params): Promise<any> {
    if (data.intent === 'undo-backfill') {
      const ids: string[] = data.practiceCostIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequest('practiceCostIds array is required');
      }
      let removed = 0;
      for (const id of ids) {
        try {
          await this.app.service('practice-costs').remove(id, { provider: undefined });
          removed++;
        } catch { /* already deleted */ }
      }
      return { removed };
    }

    if (data.intent === 'mark-billed') {
      const ids: string[] = data.practiceCostIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequest('practiceCostIds array is required');
      }
      let updated = 0;
      for (const id of ids) {
        try {
          await this.app.service('practice-costs').patch(
            id,
            { billedAt: new Date() },
            { provider: undefined },
          );
          updated++;
        } catch { /* row may not exist */ }
      }
      return { updated };
    }

    if (data.intent === 'unmark-billed') {
      const ids: string[] = data.practiceCostIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequest('practiceCostIds array is required');
      }
      let updated = 0;
      for (const id of ids) {
        try {
          await this.app.service('practice-costs').patch(
            id,
            { billedAt: null },
            { provider: undefined },
          );
          updated++;
        } catch { /* row may not exist */ }
      }
      return { updated };
    }

    if (data.intent !== 'backfill') {
      throw new BadRequest(`Unknown intent: ${data.intent}`);
    }

    if (!Array.isArray(data.practiceIds) || data.practiceIds.length === 0) {
      throw new BadRequest('practiceIds array is required');
    }

    const errors: string[] = [];
    const createdIds: string[] = [];
    let backfilled = 0;
    let skipped = 0;

    // Group by practiceType
    const practiceIds: { id: string; practiceType: string }[] = data.practiceIds;
    const studyIds = practiceIds.filter(p => p.practiceType === 'studies').map(p => p.id);
    const encounterIds = practiceIds.filter(p => p.practiceType === 'encounters').map(p => p.id);

    // Process studies
    if (studyIds.length > 0) {
      const studies = await this.app.service('studies').find({
        query: { id: { $in: studyIds } },
        paginate: false,
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

        // Skip studies with no meaningful results
        const hasAnyMeaningfulResult = [...resultsByType.values()].some(d => hasStudyResultData(d));
        if (!hasAnyMeaningfulResult) {
          skipped++;
          continue;
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
            const created = await this.app.service('practice-costs').create({
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
            createdIds.push(String(created.id));
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
      const encounters = await this.app.service('encounters').find({
        query: { id: { $in: encounterIds } },
        paginate: false,
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
          const created = await this.app.service('practice-costs').create({
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
          createdIds.push(String(created.id));
          backfilled++;
        } catch (err: any) {
          console.warn(`[accounting:backfill] skip encounter ${encounter.id}: ${err.message}`);
          if (errors.length < 5) errors.push(`encounter ${encounter.id}: ${err.message}`);
          skipped++;
        }
      }
    }

    return { backfilled, skipped, errors, createdIds };
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

    try {
      const patient = await this.app.service('patients').get(patientId, {
        query: { $select: ['medicareId'] },
      }) as { medicareId: string | null };
      return patient?.medicareId || null;
    } catch (err) {
      if (err instanceof NotFound) return null;
      throw err;
    }
  }

  private async getStudyIdsWithResults(studyIds: string[]): Promise<Set<string>> {
    if (studyIds.length === 0) return new Set();

    const results = await this.app.service('study-results').find({
      query: { studyId: { $in: studyIds } },
      paginate: false,
    }) as { studyId: string; data: Record<string, unknown> | string }[];

    const ids = new Set<string>();
    for (const sr of results) {
      const d = typeof sr.data === 'string' ? JSON.parse(sr.data) : (sr.data || {});
      if (hasStudyResultData(d)) {
        ids.add(sr.studyId);
      }
    }
    return ids;
  }
}
