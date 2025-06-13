import { HookContext } from '@feathersjs/feathers';

const safeParse = (value: any): any => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const parseDecryptedAttributes = (...fields: string[]) => {
  return async (context: HookContext) => {
    const { result, method } = context;

    if (method === 'find' && Array.isArray(result)) {
      context.result = result.map((item: any) => {
        fields.forEach((field: string) => {
          item[field] = safeParse(item[field]);
        });
        return item;
      });
    }

    if (method === 'find' && Array.isArray(result.data)) {
      context.result.data = result.data.map((item: any) => {
        fields.forEach((field: string) => {
          item[field] = safeParse(item[field]);
        });
        return item;
      });
    }

    if (method === 'get' && result) {
      fields.forEach((field: string) => {
        result[field] = safeParse(result[field]);
      });
    }

    return context;
  };
};
