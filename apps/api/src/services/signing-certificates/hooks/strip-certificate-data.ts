import { Hook, HookContext } from '@feathersjs/feathers';
import { omit } from 'lodash';

export const stripCertificateData = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (!context.params.provider) return context;

  const strip = (item: any) => {
    if (!item) return item;
    const rest = omit(item.toJSON ? item.toJSON() : item, 'certificate');
    return rest;
  };

  if (context.result?.data) {
    context.result.data = context.result.data.map(strip);
  } else if (Array.isArray(context.result)) {
    context.result = context.result.map(strip);
  } else if (context.result) {
    context.result = strip(context.result);
  }

  return context;
};
