import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Application } from '../declarations';
import {
  ENCRYPTED_UPLOAD_FILENAME,
  getUploadSigningSecret,
  verifyUploadSignature,
} from '../utils/signed-upload-url';

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.dcm': 'application/dicom',
};

export function resolveUploadsDir(app: Application): string {
  return path.resolve(app.get('uploads')?.dir || './public/uploads');
}

/**
 * Serves `*.enc` clinical attachments, decrypting on the fly.
 *
 * Every `.enc` request MUST carry a valid, unexpired signature minted by the
 * `attachment-links` service (which performs the encounter access check and
 * access logging). Requests for `.enc` files never fall through to static
 * serving, so ciphertext is never exposed either. Non-`.enc` paths are passed
 * to `next()` untouched (legacy unencrypted disk uploads).
 */
export default function encryptedUploadsHandler(app: Application) {
  const uploadsDir = resolveUploadsDir(app);

  return (req: any, res: any, next: any): void => {
    const filename = path.basename(decodeURIComponent(req.path));
    if (!filename.endsWith('.enc')) return next();

    res.set('Cache-Control', 'private, no-store');

    if (!ENCRYPTED_UPLOAD_FILENAME.test(filename)) {
      return res.status(404).send('Not found');
    }

    const secret = getUploadSigningSecret();
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!secret || !encryptionKey) {
      return res.status(500).send('Encryption key not configured');
    }

    if (!verifyUploadSignature(secret, filename, req.query?.exp, req.query?.sig)) {
      return res.status(401).send('Invalid or expired attachment link');
    }

    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }

    const data = fs.readFileSync(filePath);
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const ciphertext = data.subarray(32);

    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted: Buffer;
    try {
      decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      return res.status(500).send('Decryption failed');
    }

    // Derive content type from original extension: uuid.pdf.enc → .pdf
    const originalExt = path.extname(filename.slice(0, -4));
    const contentType = EXT_TO_MIME[originalExt] || 'application/octet-stream';

    res.set('Content-Type', contentType);
    res.set('Content-Length', String(decrypted.length));
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'attachment');
    res.send(decrypted);
  };
}
