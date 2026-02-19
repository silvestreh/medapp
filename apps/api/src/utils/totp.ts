import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const normalizeSecret = (secret: string) => secret.toUpperCase().replace(/[^A-Z2-7]/g, '');

const base32ToBuffer = (secret: string): Buffer => {
  const normalized = normalizeSecret(secret);
  let bits = '';

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error('Invalid base32 secret');
    }

    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
};

const bufferToBase32 = (buffer: Buffer) => {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let encoded = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    encoded += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return encoded;
};

const generateCounterToken = (secret: string, counter: number, digits = 6) => {
  const key = base32ToBuffer(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binaryCode % 10 ** digits).toString().padStart(digits, '0');
};

export const generateTotpSecret = (byteLength = 20) => {
  return bufferToBase32(crypto.randomBytes(byteLength));
};

export const buildTotpAuthUri = ({
  issuer,
  accountName,
  secret,
}: {
  issuer: string;
  accountName: string;
  secret: string;
}) => {
  const safeIssuer = encodeURIComponent(issuer);
  const safeAccount = encodeURIComponent(accountName);
  const safeSecret = encodeURIComponent(secret);

  return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${safeSecret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
};

export const verifyTotpCode = ({
  secret,
  code,
  window = 1,
  period = 30,
}: {
  secret: string;
  code: string;
  window?: number;
  period?: number;
}) => {
  const normalizedCode = String(code).trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 1000 / period);
  for (let counter = currentCounter - window; counter <= currentCounter + window; counter += 1) {
    if (generateCounterToken(secret, counter) === normalizedCode) {
      return true;
    }
  }

  return false;
};
