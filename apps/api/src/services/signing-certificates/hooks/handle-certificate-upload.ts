import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

export const handleCertificateUpload = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { params } = context;
  const file = (params as any).file as Express.Multer.File | undefined;

  if (!file) {
    throw new BadRequest('No certificate file provided');
  }

  const allowedExtensions = ['.pfx', '.p12'];
  const originalName = file.originalname.toLowerCase();
  if (!allowedExtensions.some(ext => originalName.endsWith(ext))) {
    throw new BadRequest('Certificate must be a .pfx or .p12 file');
  }

  const base64Certificate = file.buffer.toString('base64');

  context.data = {
    ...context.data,
    certificate: base64Certificate,
    fileName: file.originalname,
  };

  return context;
};
