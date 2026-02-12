import { Hook, HookContext } from '@feathersjs/feathers';
import { omit } from 'lodash';
import { findByPersonalData } from '../../../hooks/find-by-personal-data';

/**
 * Before.find hook for studies search.
 *
 * - If `q` is purely numeric: filter by `protocol` exact match
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

    // Purely numeric query -> exact protocol match
    if (/^\d+$/.test(trimmed)) {
      context.params.query = {
        ...omit(params.query, 'q'),
        protocol: parseInt(trimmed, 10),
      };
      return context;
    }

    // Text query -> delegate to personal data search (fuzzy name/document)
    return personalDataHook(context);
  };
}
