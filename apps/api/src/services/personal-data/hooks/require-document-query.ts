import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

/**
 * External personal-data finds exist to detect an already-registered person
 * by exact document number (patients.new duplicate check). Requiring the
 * filter prevents authenticated users from paging the whole PII table.
 */
const requireDocumentQuery = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.params.provider === undefined) return context;

  const documentValue = context.params.query?.documentValue;
  if (typeof documentValue !== 'string' || !documentValue.trim()) {
    throw new BadRequest('documentValue is required to search personal data');
  }

  return context;
};

export default requireDocumentQuery;
