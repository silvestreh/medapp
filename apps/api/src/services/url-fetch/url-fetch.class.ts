import { Params } from '@feathersjs/feathers';
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors';
import { URL } from 'url';
import dns from 'dns/promises';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import type { Application } from '../../declarations';

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 10_000;

function isPrivateIP(ip: string): boolean {
  // IPv4 private/loopback ranges
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (ip === '0.0.0.0') return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;

  // IPv6 loopback / link-local / unique local
  if (ip === '::1' || ip === '::') return true;
  if (/^fe80:/i.test(ip)) return true;
  if (/^f[cd]/i.test(ip)) return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped) return isPrivateIP(v4Mapped[1]);

  return false;
}

export class UrlFetch {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(data: { url: string }, params?: Params): Promise<{
    url: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }> {
    const { url: targetUrl } = data;

    if (!targetUrl || typeof targetUrl !== 'string') {
      throw new BadRequest('url is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new BadRequest('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequest('Only http and https URLs are supported');
    }

    // SSRF protection: resolve hostname and block private IPs
    const addresses = await dns.resolve4(parsed.hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(parsed.hostname).catch(() => [] as string[]);
    const allAddresses = [...addresses, ...addresses6];

    if (allAddresses.length === 0) {
      throw new BadRequest('Could not resolve hostname');
    }

    for (const addr of allAddresses) {
      if (isPrivateIP(addr)) {
        throw new BadRequest('URLs pointing to private/internal networks are not allowed');
      }
    }

    // HEAD request to validate content type and size
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const headRes = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual',
      });

      if (headRes.status >= 300 && headRes.status < 400) {
        throw new BadRequest('Redirects are not allowed');
      }

      if (!headRes.ok) {
        throw new BadRequest(`Remote server returned ${headRes.status}`);
      }

      const contentType = headRes.headers.get('content-type')?.split(';')[0]?.trim();
      if (!contentType || !ALLOWED_MIMES.includes(contentType)) {
        throw new BadRequest(`Unsupported content type: ${contentType || 'unknown'}. Only images are allowed.`);
      }

      const contentLength = headRes.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
        throw new BadRequest(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      // Download the file
      const getRes = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'manual',
      });

      if (getRes.status >= 300 && getRes.status < 400) {
        throw new BadRequest('Redirects are not allowed');
      }

      if (!getRes.ok || !getRes.body) {
        throw new BadRequest('Failed to download file');
      }

      const buffer = Buffer.from(await getRes.arrayBuffer());

      if (buffer.length > MAX_FILE_SIZE) {
        throw new BadRequest(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      // Derive actual content type from the GET response (more reliable)
      const actualContentType = getRes.headers.get('content-type')?.split(';')[0]?.trim() || contentType;
      if (!ALLOWED_MIMES.includes(actualContentType)) {
        throw new BadRequest(`Unsupported content type: ${actualContentType}`);
      }

      const ext = MIME_TO_EXT[actualContentType] || '.bin';
      const fileName = this.deriveFileName(parsed, ext);

      // Upload using the same pipeline as file-uploads
      const wantEncrypted = true;
      const uploadsDir = this.app.get('uploads')?.dir || './public/uploads';
      const cloudinaryConfig = this.app.get('cloudinary');

      let uploadUrl: string;

      if (wantEncrypted) {
        uploadUrl = this.encryptToDisk(buffer, ext, uploadsDir);
      } else if (cloudinaryConfig?.cloudName) {
        uploadUrl = await this.uploadToCloudinary(buffer, cloudinaryConfig);
      } else {
        uploadUrl = this.uploadToDisk(buffer, ext, uploadsDir);
      }

      return {
        url: uploadUrl,
        fileName,
        mimeType: actualContentType,
        fileSize: buffer.length,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private deriveFileName(parsed: URL, ext: string): string {
    const pathname = parsed.pathname;
    const basename = path.basename(pathname);
    if (basename && basename.includes('.')) {
      return basename;
    }
    return `downloaded-${Date.now()}${ext}`;
  }

  private encryptToDisk(buffer: Buffer, ext: string, uploadsDir: string): string {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required for encrypted uploads');

    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const dir = path.resolve(uploadsDir);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${crypto.randomUUID()}${ext}.enc`;
    fs.writeFileSync(path.join(dir, filename), Buffer.concat([iv, authTag, encrypted]));

    return `/api/uploads/${filename}`;
  }

  private uploadToDisk(buffer: Buffer, ext: string, uploadsDir: string): string {
    const dir = path.resolve(uploadsDir);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(dir, filename), buffer);

    return `/api/uploads/${filename}`;
  }

  private async uploadToCloudinary(
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
        (error: any, r: any) => {
          if (error) reject(error);
          else resolve(r);
        }
      );
      stream.end(buffer);
    });

    return result.secure_url;
  }

  async find(): Promise<any> { throw new MethodNotAllowed(); }
  async get(): Promise<any> { throw new MethodNotAllowed(); }
  async update(): Promise<any> { throw new MethodNotAllowed(); }
  async patch(): Promise<any> { throw new MethodNotAllowed(); }
  async remove(): Promise<any> { throw new MethodNotAllowed(); }
}
