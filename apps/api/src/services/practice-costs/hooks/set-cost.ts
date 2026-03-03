import { Hook, HookContext } from '@feathersjs/feathers';
import {
  toInsurerPrices,
  resolveTotalCost,
  PARTICULAR_INSURER_ID,
  extraCostSectionsByStudyType,
  hasAnyFieldValue,
  type InsurerPrices,
} from '../../../utils/cost-resolution';
import type { Application, AccountingSettings } from '../../../declarations';

type PracticeKind = 'study' | 'encounter';

async function resolveEffectiveInsurerId(
  app: Application,
  insurerId: string | null,
  patientId: string
): Promise<string | null> {
  if (insurerId) return insurerId;

  const sequelize = app.get('sequelizeClient');
  const patient = await sequelize.models.patients.findByPk(patientId, {
    attributes: ['medicareId'],
    raw: true,
  });

  return patient?.medicareId || null;
}

async function getMedicInsurerPrices(
  app: Application,
  medicId: string
): Promise<InsurerPrices> {
  const settings = await app.service('accounting-settings').find({
    query: { userId: medicId, $limit: 1 },
    paginate: false,
  }) as AccountingSettings[];

  if (settings.length === 0) return {};
  return toInsurerPrices(settings[0].insurerPrices);
}

export function setCost(kind: PracticeKind): Hook {
  return async (context: HookContext) => {
    const app = context.app as unknown as Application;
    const { result } = context;
    const records = Array.isArray(result) ? result : [result];

    for (const record of records) {
      const medicId = record.medicId;
      if (!medicId) continue;

      const insurerPrices = await getMedicInsurerPrices(app, medicId);
      const effectiveInsurerId = await resolveEffectiveInsurerId(
        app,
        record.insurerId || null,
        record.patientId,
      );
      const priceKey = effectiveInsurerId || PARTICULAR_INSURER_ID;
      const insurerPricing = insurerPrices[priceKey];

      if (!insurerPricing) {
        continue;
      }

      if (kind === 'encounter') {
        const cost = resolveTotalCost({
          insurerPricing,
          practiceType: 'encounter',
          emergency: false,
          activeSections: [],
        });

        await app.service('practice-costs').create({
          organizationId: record.organizationId || null,
          medicId,
          patientId: record.patientId,
          practiceId: record.id,
          practiceType: 'encounters',
          studyType: null,
          insurerId: effectiveInsurerId,
          emergency: false,
          date: record.date,
          cost,
        }, { provider: undefined });
      }

      if (kind === 'study') {
        const studyTypes: string[] = record.studies || [];
        const isEmergency = !!record.emergency;

        const studyResultsPayload = context.params._studyResultsPayload as
          { type: string; data: Record<string, unknown> }[] | undefined;

        for (const studyType of studyTypes) {
          const activeSections: string[] = [];
          const extraSections = extraCostSectionsByStudyType.get(studyType);
          if (extraSections && studyResultsPayload) {
            const resultEntry = studyResultsPayload.find(r => r.type === studyType);
            if (resultEntry?.data) {
              for (const section of extraSections) {
                if (hasAnyFieldValue(resultEntry.data as Record<string, unknown>, section.fieldNames)) {
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
