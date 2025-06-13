import { Hook } from '@feathersjs/feathers';
import { encryptValue } from '../../../hooks/encryption';

export const encryptPhoneNumbers = (): Hook => {
  return async (context) => {
    const { data } = context;
    if (!data || !data.phoneNumber) return context;

    if (Array.isArray(data.phoneNumber)) {
      data.phoneNumber = data.phoneNumber
        .map((phone: string) => encryptValue(phone))
        .filter((phone: string) => phone !== null)
        .join(',');
    } else {
      // Handle single phone number
      data.phoneNumber = encryptValue(data.phoneNumber);
    }

    return context;
  };
};
