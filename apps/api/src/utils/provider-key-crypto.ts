import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedProviderKey {
  iv: string;
  tag: string;
  ciphertext: string;
}

function getSecret(app: any): string {
  const authSecret = app.get('authentication')?.secret;
  if (typeof authSecret === 'string' && authSecret.length > 0) {
    return authSecret;
  }
  return process.env.ENCRYPTION_KEY || 'athelas-llm-provider-key-fallback';
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptProviderKey(app: any, plainText: string): EncryptedProviderKey {
  const iv = randomBytes(12);
  const key = deriveKey(getSecret(app));
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptProviderKey(app: any, encrypted: EncryptedProviderKey): string {
  const key = deriveKey(getSecret(app));
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
