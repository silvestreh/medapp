import { Hook, HookContext } from '@feathersjs/feathers';
import type { Application, PracticeCost } from '../../../declarations';
import {
  toInsurerPrices,
  resolveTotalCost,
  PARTICULAR_INSURER_ID,
  extraCostSectionsByStudyType,
  hasAnyFieldValue,
} from '../../../utils/cost-resolution';

export function recalculateUnbilledCosts(): Hook {
  return async (context: HookContext) => {
    const app = context.app as unknown as Application;
    const result = context.result;
    const medicId = result?.userId;

    if (!medicId || !result?.insurerPrices) return context;

    const insurerPrices = toInsurerPrices(result.insurerPrices);

    // Find all unbilled practice_costs for this medic
    const unbilledCosts = await app.service('practice-costs').find({
      query: { medicId, billedAt: null },
      paginate: false,
    }) as PracticeCost[];

    if (unbilledCosts.length === 0) return context;

    // Batch fetch study results for all study-type costs
    const studyPracticeIds = [
      ...new Set(
        unbilledCosts
          .filter(c => c.practiceType === 'studies')
          .map(c => String(c.practiceId))
      ),
    ];

    const allStudyResults = studyPracticeIds.length
      ? await app.service('study-results').find({
        query: { studyId: { $in: studyPracticeIds } },
        paginate: false,
      }) as { studyId: string; type: string; data: Record<string, unknown> | string }[]
      : [];

    // Group study results by studyId + type
    const resultsByStudyAndType = new Map<string, Record<string, unknown>>();
    for (const sr of allStudyResults) {
      const d = typeof sr.data === 'string' ? JSON.parse(sr.data) : (sr.data || {});
      resultsByStudyAndType.set(`${sr.studyId}:${sr.type}`, d);
    }

    // Batch fetch patients for insurer ID resolution and tier name
    const allPatientIds = [
      ...new Set(unbilledCosts.map(c => String(c.patientId))),
    ];

    const patients = allPatientIds.length
      ? await app.service('patients').find({
        query: { id: { $in: allPatientIds }, $select: ['id', 'medicareId', 'medicarePlan'] },
        paginate: false,
      }) as { id: string; medicareId: string | null; medicarePlan: string | null }[]
      : [];

    const medicareByPatientId = new Map(
      patients.map(p => [String(p.id), p.medicareId])
    );

    const medicarePlanByPatientId = new Map(
      patients.map(p => [String(p.id), p.medicarePlan])
    );

    for (const cost of unbilledCosts) {
      const effectiveInsurerId = cost.insurerId
        ? String(cost.insurerId)
        : (medicareByPatientId.get(String(cost.patientId)) || null);
      const priceKey = effectiveInsurerId || PARTICULAR_INSURER_ID;
      const insurerPricing = insurerPrices[priceKey];

      if (!insurerPricing) continue;

      let activeSections: string[] = [];

      if (cost.practiceType === 'studies' && cost.studyType) {
        const extraSections = extraCostSectionsByStudyType.get(cost.studyType);
        if (extraSections) {
          const resultData = resultsByStudyAndType.get(
            `${cost.practiceId}:${cost.studyType}`
          );
          if (resultData) {
            activeSections = extraSections
              .filter(section => hasAnyFieldValue(resultData, section.fieldNames))
              .map(section => section.name);
          }
        }
      }

      const practiceType = cost.practiceType === 'encounters'
        ? 'encounter'
        : (cost.studyType || 'encounter');

      const tierName = medicarePlanByPatientId.get(String(cost.patientId)) || null;

      const newCost = resolveTotalCost({
        insurerPricing,
        practiceType,
        emergency: cost.emergency,
        activeSections,
        tierName,
      });

      if (Number(cost.cost) !== newCost) {
        await app.service('practice-costs').patch(
          cost.id,
          { cost: newCost },
          { provider: undefined },
        );
      }
    }

    return context;
  };
}
