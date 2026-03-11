import crypto from 'crypto';

/**
 * Derive a 256-bit key from a passphrase using SHA-256.
 * Each service should pass its own ENCRYPTION_KEY.
 */
export const createEncryptionKey = (passphrase: string): Buffer =>
  crypto.createHash('sha256').update(passphrase).digest();

/**
 * Encrypt a value using AES-256-ECB (field-level encryption for non-PGP columns).
 */
export const encryptValue = (value: any, key: Buffer): string | null => {
  if (value === null || value === undefined) return null;
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
  return Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]).toString('hex');
};

/**
 * Decrypt an AES-256-ECB encrypted hex string.
 */
export const decryptValue = (encrypted: any, key: Buffer): string | null => {
  if (encrypted === null || encrypted === undefined) return null;
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

/**
 * Encrypt a JSON-serializable value into a hex string.
 * Uses AES-256-GCM for authenticated encryption.
 */
export const encryptJson = (value: unknown, key: Buffer): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(24hex) + tag(32hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
};

/**
 * Decrypt a hex string back into the original JSON value.
 */
export const decryptJson = (encrypted: string, key: Buffer): unknown => {
  const iv = Buffer.from(encrypted.slice(0, 24), 'hex');
  const tag = Buffer.from(encrypted.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(encrypted.slice(56), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};
