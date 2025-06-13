import { Hook, HookContext } from '@feathersjs/feathers';

export const sanitizeEncryptedData = (...fields: string[]): Hook => {
  return async (context: HookContext) => {
    const sanitize = (data: any) => {
      if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data).replace(/\$/g, '\\$');
      } else if (typeof data === 'string') {
        return data.replace(/\$/g, '\\$');
      }
      return data;
    };

    fields.forEach(field => {
      if (context.data && context.data[field]) {
        context.data[field] = sanitize(context.data[field]);
      }
    });

    return context;
  };
};
