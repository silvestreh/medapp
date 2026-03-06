import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
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
      { folder: 'medapp-uploads', resource_type: 'image' },
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

export const handleFileUpload = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const file = (context.params as any).file as Express.Multer.File | undefined;

  if (!file) {
    throw new BadRequest('No file provided');
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new BadRequest(`File type ${file.mimetype} not allowed`);
  }

  if (file.size > MAX_SIZE) {
    throw new BadRequest('File exceeds 2MB limit');
  }

  const ext = MIME_TO_EXT[file.mimetype] || '.bin';
  const cloudinaryConfig = context.app.get('cloudinary');

  let url: string;

  if (cloudinaryConfig?.cloudName) {
    url = await uploadToCloudinary(file.buffer, cloudinaryConfig);
  } else {
    const uploadsDir = context.app.get('uploads')?.dir || './public/uploads';
    url = uploadToDisk(file.buffer, ext, uploadsDir);
  }

  (context.params as any).uploadResult = url;

  return context;
};
