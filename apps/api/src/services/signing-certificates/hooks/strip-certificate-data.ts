import { Hook, HookContext } from '@feathersjs/feathers';

export const stripCertificateData = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (!context.params.provider) return context;

  const strip = (item: any) => {
    if (!item) return item;
    const { certificate, ...rest } = item.toJSON ? item.toJSON() : item;
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
