const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'otp',
  'code',
  'accessToken',
  'refreshToken',
  'authorization',
  'documentNumber',
  'documentValue',
  'firstName',
  'lastName',
  'surname',
  'phone',
  'phoneNumber',
  'birthDate',
  'medicareNumber',
  'nationalId',
  'cuil',
  'ssn',
  'mugshot',
  'signatureImage',
]);

export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForLog);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
