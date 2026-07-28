import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden, NotFound } from '@feathersjs/errors';

/**
 * form_template_versions has no organizationId column — ownership derives
 * through formTemplateId → form_templates.organizationId.
 *
 * before find: constrains the query to the active organization's templates.
 * after get: verifies the fetched version's template belongs to it.
 * Internal calls and super admins are skipped.
 */
const scopeVersionsToOrganization = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;

  if (params.provider === undefined || !params.user) return context;
  if (params.isSuperAdmin) return context;

  if (!params.organizationId) {
    throw new Forbidden('An organization context is required');
  }

  if (context.type === 'before' && context.method === 'find') {
    const templates = (await app.service('form-templates').find({
      query: { organizationId: params.organizationId, $select: ['id'] },
      paginate: false,
    })) as any[];
    const allowedIds = templates.map((template) => String(template.id));

    const requested = context.params.query?.formTemplateId;
    if (typeof requested === 'string') {
      if (!allowedIds.includes(requested)) {
        throw new Forbidden('Cannot access versions for this template');
      }
    } else {
      context.params.query = {
        ...context.params.query,
        formTemplateId: { $in: allowedIds },
      };
    }
  }

  if (context.type === 'after' && context.method === 'get' && context.result) {
    const template: any = await app.service('form-templates').get(context.result.formTemplateId);
    if (String(template.organizationId) !== String(params.organizationId)) {
      throw new NotFound(`No record found for id '${context.id}'`);
    }
  }

  return context;
};

export default scopeVersionsToOrganization;
