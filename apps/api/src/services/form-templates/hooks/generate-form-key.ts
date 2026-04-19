import { Hook, HookContext } from '@feathersjs/feathers';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const generateFormKey = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { data, app, params } = context;

    if (!data.name) {
      return context;
    }

    const baseSlug = slugify(data.name);
    let formKey = `custom/${baseSlug}`;
    let counter = 1;

    // Ensure uniqueness within the organization
    const organizationId = data.organizationId || params.organizationId;

    while (true) {
      const existing = await app.service('form-templates').find({
        query: {
          organizationId,
          formKey,
          $limit: 1,
        },
        paginate: false,
      });

      if ((existing as any[]).length === 0) {
        break;
      }

      counter++;
      formKey = `custom/${baseSlug}-${counter}`;
    }

    context.data = {
      ...context.data,
      formKey,
    };

    return context;
  };
};
