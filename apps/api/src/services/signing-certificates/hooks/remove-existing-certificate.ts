import { Hook, HookContext } from '@feathersjs/feathers';

export const removeExistingCertificate = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const userId = context.data?.userId;
  if (!userId) return context;

  const existing: any[] = await context.service.find({
    query: { userId },
    paginate: false,
    provider: undefined,
  } as any);

  for (const cert of existing) {
    await context.service.remove(cert.id, { provider: undefined } as any);
  }

  return context;
};
