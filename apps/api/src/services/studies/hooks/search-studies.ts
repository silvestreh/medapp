import { Hook, HookContext } from '@feathersjs/feathers';
import { omit } from 'lodash';
import { findByPersonalData } from '../../../hooks/find-by-personal-data';

/**
 * Before.find hook for studies search.
 *
 * - If `q` is purely numeric: search by documentValue (and protocol exact match)
 * - If `q` is text: delegate to the shared personal data search
 * - If no `q`: pass through
 */
export default function searchStudies(): Hook {
  const personalDataHook = findByPersonalData({
    junctionService: 'patient-personal-data',
    foreignKey: 'patientId',
  });

  return async (context: HookContext) => {
    const { params } = context;
    const q = params.query?.q;

    if (!q) {
      return context;
    }

    const trimmed = q.trim();

    // Purely numeric query -> search by documentValue + protocol
    if (/^\d+$/.test(trimmed)) {
      context.params.query = {
        ...omit(params.query, 'q'),
        documentValue: trimmed,
      };
      await personalDataHook(context);

      // Also include protocol matches via $or
      const protocol = parseInt(trimmed, 10);
      const currentQuery = context.params.query;

      if (currentQuery.patientId === 'none') {
        // No documentValue match — fall back to exact protocol match
        delete currentQuery.patientId;
        currentQuery.protocol = protocol;
      } else if (currentQuery.patientId) {
        // Has documentValue matches — also include exact protocol match
        const patientIdCondition = currentQuery.patientId;
        delete currentQuery.patientId;
        currentQuery.$or = [
          { patientId: patientIdCondition },
          { protocol },
        ];
      }

      return context;
    }

    // Text query -> delegate to personal data search (fuzzy name/document)
    return personalDataHook(context);
  };
}
