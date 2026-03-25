import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

/**
 * Before hook: sanitizes and validates the referringDoctor field.
 * - Strips non-standard characters (en/em dashes, special punctuation, etc.)
 * - Requires the field (or medicId) on create
 */
export default function sanitizeReferringDoctor(): Hook {
  return async (context: HookContext) => {
    const { data, method } = context;
    if (!data) return context;

    if (typeof data.referringDoctor === 'string') {
      data.referringDoctor = data.referringDoctor
        .replace(/[^\w\s.,()áéíóúàèìòùäëïöüâêîôûñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ'-]/g, '')
        .trim();
    }

    if (method === 'create') {
      const hasDoctor = data.medicId || (data.referringDoctor && data.referringDoctor.trim());
      if (!hasDoctor) {
        throw new BadRequest('referringDoctor or medicId is required');
      }
    }

    return context;
  };
}
