import { createEncryptionKey, encryptJson as _encryptJson, decryptJson as _decryptJson } from '@athelas/encryption';

function getKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required');
  return createEncryptionKey(encryptionKey);
}

export function encryptJson(value: unknown): string {
  return _encryptJson(value, getKey());
}

export function decryptJson(encrypted: string): unknown {
  return _decryptJson(encrypted, getKey());
}
