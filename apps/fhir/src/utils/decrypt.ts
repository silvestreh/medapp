import crypto from 'crypto';

const key = crypto.createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || '')
  .digest();

/**
 * Encrypt a plaintext value using AES-256-ECB (deterministic).
 * Used for querying encrypted columns like documentValue and birthDate.
 */
export function encryptValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
  return Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final()
  ]).toString('hex');
}

export function decryptValue(encrypted: string | null | undefined): string | null {
  if (encrypted === null || encrypted === undefined) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    // If decryption fails (e.g. value isn't encrypted), return as-is
    return encrypted;
  }
}

/**
 * Decrypt phone numbers stored as comma-separated encrypted values.
 * Returns the first phone number as a plain string.
 */
export function decryptPhoneNumber(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  const parts = encrypted.split(',');
  for (const part of parts) {
    const decrypted = decryptValue(part.trim());
    if (decrypted) return decrypted.replace(/^(tel|cel):/i, '').trim();
  }
  return null;
}

/** Decrypt personal_data fields in-place */
export function decryptPersonalData(pd: Record<string, unknown>): void {
  if (pd.documentValue) pd.documentValue = decryptValue(pd.documentValue as string);
  if (pd.birthDate) pd.birthDate = decryptValue(pd.birthDate as string);
}

/** Decrypt contact_data fields in-place */
export function decryptContactData(cd: Record<string, unknown>): void {
  if (cd.email) cd.email = decryptValue(cd.email as string);
  if (cd.streetAddress) cd.streetAddress = decryptValue(cd.streetAddress as string);
  if (cd.city) cd.city = decryptValue(cd.city as string);
  if (cd.province) cd.province = decryptValue(cd.province as string);
  if (cd.phoneNumber) cd.phoneNumber = decryptPhoneNumber(cd.phoneNumber as string);
}

/**
 * Decrypt a plain patient/user record that includes personal_data and contact_data arrays.
 * Mutates the record in-place and returns it for chaining.
 */
export function decryptPatientRecord<T extends Record<string, unknown>>(record: T): T {
  const personalDataList = record.personal_data as Record<string, unknown>[] | undefined;
  if (personalDataList) {
    for (const pd of personalDataList) {
      decryptPersonalData(pd);
    }
  }

  const contactDataList = record.contact_data as Record<string, unknown>[] | undefined;
  if (contactDataList) {
    for (const cd of contactDataList) {
      decryptContactData(cd);
    }
  }

  return record;
}
