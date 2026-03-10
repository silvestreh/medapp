import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Decrypts an AES-256-GCM encrypted file from the uploads directory.
 * Format: [16 bytes IV][16 bytes authTag][ciphertext]
 */
export function decryptFileFromDisk(uploadsDir: string, fileUrl: string): Buffer {
  // fileUrl is like /api/uploads/uuid.jpg.enc — strip prefix to get filename
  const filename = fileUrl.replace(/^\/api\/uploads\//, '');
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  const data = fs.readFileSync(filePath);
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);

  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
