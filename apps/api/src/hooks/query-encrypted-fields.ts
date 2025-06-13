import { Hook, HookContext } from '@feathersjs/feathers';

import { encryptValue } from './encryption';

function encryptQueryFields(query: any, encryptedFields: string[]): any {
  if (typeof query !== 'object' || query === null) return query;

  const encryptedQuery = { ...query };

  Object.keys(encryptedQuery).forEach(key => {
    if (encryptedFields.includes(key) && typeof encryptedQuery[key] === 'string') {
      encryptedQuery[key] = encryptValue(encryptedQuery[key]);
    } else if (typeof encryptedQuery[key] === 'object') {
      if (key === '$or' && Array.isArray(encryptedQuery[key])) {
        encryptedQuery[key] = encryptedQuery[key].map((subQuery: any) => encryptQueryFields(subQuery, encryptedFields));
      } else {
        encryptedQuery[key] = encryptQueryFields(encryptedQuery[key], encryptedFields);
      }
    }
  });

  return encryptedQuery;
}

function hasEncryptedFields(query: any, encryptedFields: string[]): boolean {
  if (typeof query !== 'object' || query === null) return false;

  return Object.keys(query).some(key => {
    if (encryptedFields.includes(key)) {
      return true;
    } else if (typeof query[key] === 'object') {
      return hasEncryptedFields(query[key], encryptedFields);
    }
    return false;
  });
}

export default function queryEncryptedFields(...encryptedFields: string[]): Hook {
  return async (context: HookContext): Promise<HookContext> => {
    const { query } = context.params;

    if (!query) return context;

    // Check if any encrypted fields are being queried at any level
    if (hasEncryptedFields(query, encryptedFields)) {
      const encryptedQuery = encryptQueryFields(query, encryptedFields);
      context.params.query = encryptedQuery;
    }

    return context;
  };
};
