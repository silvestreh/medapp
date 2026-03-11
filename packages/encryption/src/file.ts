import crypto from 'crypto';
import fs from 'fs';

/**
 * Encrypt a file buffer using AES-256-GCM.
 * Returns: IV (16 bytes) + authTag (16 bytes) + ciphertext.
 */
export const encryptFile = (data: Buffer, passphrase: string): Buffer => {
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
};

/**
 * Decrypt an encrypted file buffer (IV + authTag + ciphertext).
 */
export const decryptFileToBuffer = (data: Buffer, passphrase: string): Buffer => {
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

/**
 * Read and decrypt an encrypted file from disk.
 */
export const decryptFile = (filePath: string, passphrase: string): Buffer => {
  const data = fs.readFileSync(filePath);
  return decryptFileToBuffer(data, passphrase);
};
