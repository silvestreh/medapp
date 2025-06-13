import crypto from 'crypto';
import { Hook } from '@feathersjs/feathers';

const key = crypto.createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || '')
  .digest();

export const encryptValue = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
  return Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final()
  ]).toString('hex');
};

export const decryptValue = (encrypted: any): string | null => {
  if (encrypted === null || encrypted === undefined) return null;
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final()
  ]).toString('utf8');
};

export const encryptFields = (...fields: string[]): Hook => {
  return async (context) => {
    const { data } = context;
    if (!data) return context;

    fields.forEach(field => {
      if (data[field] !== undefined) {
        data[field] = encryptValue(data[field]);
      }
    });

    return context;
  };
};

export const decryptFields = (...fields: string[]): Hook => {
  return async (context) => {
    const { result } = context;
    if (!result) return context;

    const decryptField = (item: any) => {
      fields.forEach(field => {
        if (item[field] !== undefined) {
          item[field] = decryptValue(item[field]);
        }
      });
    };

    if (Array.isArray(result.data)) {
      result.data.forEach(decryptField);
    } else if (Array.isArray(result)) {
      result.forEach(decryptField);
    } else {
      decryptField(result);
    }

    return context;
  };
};
