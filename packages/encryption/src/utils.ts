/** Simple object check (avoids lodash dependency). */
export const isObject = (value: any): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
