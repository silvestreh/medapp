import { Hook } from '@feathersjs/feathers';
import { decryptValue } from '../../../hooks/encryption';

export const decryptPhoneNumbers = (): Hook => {
  return async (context) => {
    const { result } = context;
    if (!result) return context;

    const decryptPhoneNumber = (item: any) => {
      if (!item.phoneNumber) return;

      if (item.phoneNumber.includes(',')) {
        item.phoneNumber = item.phoneNumber
          .split(',')
          .map((phone: string) => decryptValue(phone))
          .filter((phone: string) => phone !== null);
      } else {
        item.phoneNumber = decryptValue(item.phoneNumber);
      }
    };

    if (Array.isArray(result.data)) {
      result.data.forEach(decryptPhoneNumber);
    } else if (Array.isArray(result)) {
      result.forEach(decryptPhoneNumber);
    } else {
      decryptPhoneNumber(result);
    }

    return context;
  };
};
