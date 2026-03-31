import { Hook, HookContext } from '@feathersjs/feathers';
import {
  toInsurerPrices,
  resolveTotalCost,
  PARTICULAR_INSURER_ID,
  extraCostSectionsByStudyType,
  hasAnyFieldValue,
} from '../../../utils/cost-resolution';
import type { Application, AccountingSettings } from '../../../declarations';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function updateCost(kind: 'study'): Hook {
  return async (context: HookContext) => {
    const app = context.app as unknown as Application;
    const { result } = context;

    const studyResultsPayload = context.params._studyResultsPayload as
      { type: string; data: Record<string, unknown> }[] | undefined;

    if (!studyResultsPayload || studyResultsPayload.length === 0) {
      return context;
    }

    const records = Array.isArray(result) ? result : [result];

    for (const record of records) {
      const medicId = record.medicId;
      if (!medicId) continue;

      const settings = await app.service('accounting-settings').find({
        query: { userId: medicId, $limit: 1 },
        paginate: false,
      }) as AccountingSettings[];
      if (settings.length === 0) continue;

      const insurerPrices = toInsurerPrices(settings[0].insurerPrices);

      let effectiveInsurerId = record.insurerId || null;
      let tierName: string | null = null;
      {
        const sequelize = app.get('sequelizeClient');
        const patient = await sequelize.models.patients.findByPk(record.patientId, {
          attributes: ['medicareId', 'medicarePlan'],
          raw: true,
        });
        if (!effectiveInsurerId) {
          effectiveInsurerId = patient?.medicareId || null;
        }
        tierName = patient?.medicarePlan || null;
      }

      const priceKey = effectiveInsurerId || PARTICULAR_INSURER_ID;
      const insurerPricing = insurerPrices[priceKey];
      const isEmergency = !!record.emergency;

      // Fetch all existing study results for this study
      const allStudyResults = await app.service('study-results').find({
        query: { studyId: record.id },
        paginate: false,
      }) as { type: string; data: Record<string, unknown> | string }[];

      // Merge: prefer payload data (fresher), fall back to DB data
      const resultsByType = new Map<string, Record<string, unknown>>();
      for (const sr of allStudyResults) {
        const data = typeof sr.data === 'string' ? JSON.parse(sr.data) : sr.data;
        resultsByType.set(sr.type, data || {});
      }
      for (const entry of studyResultsPayload) {
        resultsByType.set(entry.type, entry.data || {});
      }

      const studyTypes: string[] = record.studies || [];

      for (const studyType of studyTypes) {
        const activeSections: string[] = [];
        const extraSections = extraCostSectionsByStudyType.get(studyType);
        if (extraSections) {
          const data = resultsByType.get(studyType);
          if (data) {
            for (const section of extraSections) {
              if (hasAnyFieldValue(data, section.fieldNames)) {
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
          tierName,
        });

        // Upsert: find existing cost row for this (practiceId, studyType)
        const existing = await app.service('practice-costs').find({
          query: {
            practiceId: record.id,
            studyType,
            $limit: 1,
          },
          paginate: false,
        }) as any[];

        if (existing.length > 0) {
          // Don't update cost on billed rows — the price is locked
          if (existing[0].billedAt != null) continue;

          await app.service('practice-costs').patch(
            existing[0].id,
            {
              cost,
              insurerId: effectiveInsurerId,
              emergency: isEmergency,
            },
            { provider: undefined },
          );
        } else {
          await app.service('practice-costs').create({
            organizationId: record.organizationId || null,
            medicId,
            patientId: record.patientId,
            practiceId: record.id,
            practiceType: 'studies',
            studyType,
            insurerId: effectiveInsurerId,
            emergency: isEmergency,
            date: record.date,
            cost,
          }, { provider: undefined });
        }
      }
    }

    return context;
  };
}
