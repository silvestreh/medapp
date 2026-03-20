const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
}

/**
 * Encrypts data with a user-chosen PIN using AES-256-GCM + PBKDF2.
 * Returns a packed ArrayBuffer: salt(16) || iv(12) || ciphertext.
 */
export async function encryptWithPin(data: ArrayBuffer, pin: string): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(pin, salt);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  const packed = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  packed.set(salt, 0);
  packed.set(iv, SALT_LENGTH);
  packed.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return packed.buffer;
}
