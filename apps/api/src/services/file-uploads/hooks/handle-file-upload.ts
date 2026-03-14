import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const ALLOWED_MIMES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
  'application/pdf',
  'application/dicom',
];

const MAX_SIZE_BY_MIME: Record<string, number> = {
  'image/png': 5 * 1024 * 1024,
  'image/jpeg': 5 * 1024 * 1024,
  'image/webp': 5 * 1024 * 1024,
  'image/gif': 5 * 1024 * 1024,
  'image/svg+xml': 2 * 1024 * 1024,
  'application/pdf': 10 * 1024 * 1024,
  'application/dicom': 50 * 1024 * 1024,
};

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/dicom': '.dcm',
};

async function uploadToCloudinary(
  buffer: Buffer,
  config: { cloudName: string; apiKey: string; apiSecret: string }
): Promise<string> {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
  });

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'medapp-uploads', resource_type: 'auto' },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

  return result.secure_url;
}

function uploadToDisk(
  buffer: Buffer,
  ext: string,
  uploadsDir: string
): string {
  const dir = path.resolve(uploadsDir);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/api/uploads/${filename}`;
}

function encryptToDisk(
  buffer: Buffer,
  ext: string,
  uploadsDir: string
): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required for encrypted uploads');

  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const dir = path.resolve(uploadsDir);
  fs.mkdirSync(dir, { recursive: true });

  // Filename: uuid.originalExt.enc — so we can derive content type when serving
  const filename = `${crypto.randomUUID()}${ext}.enc`;
  fs.writeFileSync(path.join(dir, filename), Buffer.concat([iv, authTag, encrypted]));

  return `/api/uploads/${filename}`;
}

export const handleFileUpload = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const file = (context.params as any).file as Express.Multer.File | undefined;

  if (!file) {
    throw new BadRequest('No file provided');
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new BadRequest(`File type ${file.mimetype} not allowed`);
  }

  const maxForType = MAX_SIZE_BY_MIME[file.mimetype] || 2 * 1024 * 1024;
  if (file.size > maxForType) {
    throw new BadRequest(`File exceeds ${Math.round(maxForType / 1024 / 1024)}MB limit for this file type`);
  }

  const ext = MIME_TO_EXT[file.mimetype] || '.bin';
  const wantEncrypted = context.params.query?.encrypted === 'true';
  const uploadsDir = context.app.get('uploads')?.dir || './public/uploads';
  const cloudinaryConfig = context.app.get('cloudinary');

  let url: string;

  if (wantEncrypted) {
    url = encryptToDisk(file.buffer, ext, uploadsDir);
  } else if (cloudinaryConfig?.cloudName) {
    url = await uploadToCloudinary(file.buffer, cloudinaryConfig);
  } else {
    url = uploadToDisk(file.buffer, ext, uploadsDir);
  }

  (context.params as any).uploadResult = url;

  return context;
};
