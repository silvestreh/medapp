import crypto from 'crypto';

/**
 * Short-lived signed URLs for encrypted uploads (`/uploads/<uuid>.<ext>.enc`).
 *
 * The `/uploads` express handler runs outside Feathers, so it never sees a JWT
 * and browser `<img>`/`<iframe>`/`<a download>` consumers can't attach one.
 * Instead, the authenticated `attachment-links` service verifies the caller can
 * read the owning encounter, writes an access-log entry, and mints a URL that
 * carries an expiry and an HMAC over `filename:exp`. The handler only needs the
 * secret to validate it.
 */

const SIGNING_CONTEXT = 'athelas-uploads-url-signing-v1';

export function getUploadSigningSecret(): Buffer | null {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) return null;
  // Domain-separated derivation so the signing key is never the raw file key.
  return crypto.createHmac('sha256', encryptionKey).update(SIGNING_CONTEXT).digest();
}

function computeSignature(secret: Buffer, filename: string, exp: number): string {
  return crypto.createHmac('sha256', secret).update(`${filename}:${exp}`).digest('hex');
}

export function signUploadUrl(
  secret: Buffer,
  filename: string,
  ttlSeconds: number,
  now: number = Date.now()
): { url: string; expiresAt: Date } {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const sig = computeSignature(secret, filename, exp);
  return {
    url: `/api/uploads/${encodeURIComponent(filename)}?exp=${exp}&sig=${sig}`,
    expiresAt: new Date(exp * 1000),
  };
}

export function verifyUploadSignature(
  secret: Buffer,
  filename: string,
  exp: unknown,
  sig: unknown,
  now: number = Date.now()
): boolean {
  if (typeof exp !== 'string' || typeof sig !== 'string') return false;
  if (!/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false;

  const expNum = parseInt(exp, 10);
  if (expNum * 1000 <= now) return false;

  const expected = Buffer.from(computeSignature(secret, filename, expNum), 'hex');
  const provided = Buffer.from(sig, 'hex');
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

/** A safe, bare `.enc` filename as produced by `encryptToDisk` (no path parts). */
export const ENCRYPTED_UPLOAD_FILENAME = /^[0-9a-f-]{36}\.[a-z0-9]{1,5}\.enc$/i;
