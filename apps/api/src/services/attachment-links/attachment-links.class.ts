import { Id, Params } from '@feathersjs/feathers';
import { BadRequest, GeneralError, MethodNotAllowed, NotFound } from '@feathersjs/errors';
import type { Application } from '../../declarations';
import {
  ENCRYPTED_UPLOAD_FILENAME,
  getUploadSigningSecret,
  signUploadUrl,
} from '../../utils/signed-upload-url';

export interface AttachmentLinkRequest {
  encounterId: Id;
  url: string;
}

export interface AttachmentLink {
  url: string;
  expiresAt: Date;
  encounterId: Id;
  patientId: Id;
  filename: string;
  fileName?: string;
}

const DEFAULT_TTL_SECONDS = 10 * 60;

/** Extract the bare `.enc` filename from a stored attachment url (`/api/uploads/<file>`). */
export function parseEncryptedUploadUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/api\/uploads\/([^/?#]+)$/.exec(url);
  if (!match) return null;
  const filename = decodeURIComponent(match[1]);
  return ENCRYPTED_UPLOAD_FILENAME.test(filename) ? filename : null;
}

/**
 * Mints short-lived signed URLs for encrypted encounter attachments.
 *
 * `create({ encounterId, url })` loads the encounter THROUGH the encounters
 * service with the caller's params, so the regular org / medic / shared-access
 * scoping decides whether the caller may see it, then checks the url is one of
 * that encounter's attachments before signing.
 */
export class AttachmentLinks {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: AttachmentLinkRequest, params: Params = {}): Promise<AttachmentLink> {
    const { encounterId, url } = data || ({} as AttachmentLinkRequest);
    if (!encounterId) throw new BadRequest('encounterId is required');

    const filename = parseEncryptedUploadUrl(url);
    if (!filename) throw new BadRequest('url must point to an encrypted upload');

    const secret = getUploadSigningSecret();
    if (!secret) throw new GeneralError('Encryption key not configured');

    // Forward the caller's identity/context so encounter permission hooks apply.
    // `query` is reset: the caller's query (if any) has no meaning for a get.
    const encounter: any = await this.app.service('encounters').get(encounterId, {
      ...params,
      query: {},
    });

    const attachments: any[] = Array.isArray(encounter?.data?.attachments)
      ? encounter.data.attachments
      : [];
    const attachment = attachments.find(att => parseEncryptedUploadUrl(att?.url) === filename);
    if (!attachment) throw new NotFound('Attachment not found');

    const ttl = Number(this.app.get('uploads')?.linkTtlSeconds) || DEFAULT_TTL_SECONDS;
    const signed = signUploadUrl(secret, filename, ttl);

    return {
      ...signed,
      encounterId: encounter.id,
      patientId: encounter.patientId,
      filename,
      fileName: attachment.fileName,
    };
  }

  async find(): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async update(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async patch(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async remove(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
}
