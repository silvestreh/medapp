import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

export const handleCertificateUpload = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { params } = context;
  const file = (params as any).file as Express.Multer.File | undefined;
  const isClientEncrypted = !!(params as any).isClientEncrypted;

  if (!file) {
    throw new BadRequest('No certificate file provided');
  }

  const allowedExtensions = ['.pfx', '.p12'];
  const originalName = file.originalname.toLowerCase();
  if (!allowedExtensions.some(ext => originalName.endsWith(ext))) {
    throw new BadRequest('Certificate must be a .pfx or .p12 file');
  }

  const MAX_CERT_SIZE = 50 * 1024;
  if (file.size > MAX_CERT_SIZE) {
    throw new BadRequest('Certificate file exceeds 50KB limit');
  }

  if (!isClientEncrypted) {
    if (file.buffer.length < 2 || file.buffer[0] !== 0x30 || file.buffer[1] !== 0x82) {
      throw new BadRequest('Invalid certificate file format');
    }
  }

  const base64Certificate = file.buffer.toString('base64');

  context.data = {
    ...context.data,
    certificate: base64Certificate,
    fileName: file.originalname,
    isClientEncrypted,
  };

  return context;
};
