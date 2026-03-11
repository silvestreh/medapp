import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function getKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required for encrypted uploads');
  return crypto.createHash('sha256').update(encryptionKey).digest();
}

/**
 * Encrypts a buffer with AES-256-GCM and writes it to disk.
 * Format: [16 bytes IV][16 bytes authTag][ciphertext]
 * Returns a URL path like /uploads/uuid.jpg.enc
 */
export function encryptToDisk(buffer: Buffer, ext: string, uploadsDir: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const dir = path.resolve(uploadsDir);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}${ext}.enc`;
  fs.writeFileSync(path.join(dir, filename), Buffer.concat([iv, authTag, encrypted]));

  return `/uploads/${filename}`;
}

/**
 * Decrypts an AES-256-GCM encrypted file from the uploads directory.
 * fileUrl is like /uploads/uuid.jpg.enc
 */
export function decryptFileFromDisk(uploadsDir: string, fileUrl: string): Buffer {
  const filename = fileUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const data = fs.readFileSync(filePath);
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);

  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Deletes an encrypted file from disk.
 * fileUrl is like /uploads/uuid.jpg.enc
 */
export function deleteFromDisk(uploadsDir: string, fileUrl: string): void {
  const filename = fileUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
