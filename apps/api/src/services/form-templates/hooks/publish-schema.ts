import { Hook, HookContext } from '@feathersjs/feathers';

export const publishSchema = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { result, app } = context;

    if (result.status !== 'published') {
      return context;
    }

    // Check if status actually changed to 'published' in this patch
    const previousData = context.params._previousData;
    if (previousData && previousData.status === 'published') {
      return context;
    }

    // Get the latest version number for this template
    const existingVersions = await app.service('form-template-versions').find({
      query: {
        formTemplateId: result.id,
        $sort: { version: -1 },
        $limit: 1,
      },
      paginate: false,
    });

    const nextVersion = (existingVersions as any[]).length > 0
      ? (existingVersions as any[])[0].version + 1
      : 1;

    // Create the version snapshot
    const version = await app.service('form-template-versions').create({
      formTemplateId: result.id,
      version: nextVersion,
      schema: result.schema,
    });

    // Update the template's currentVersionId
    await app.service('form-templates').patch(result.id, {
      currentVersionId: version.id,
    }, { _skipPublish: true });

    // Update the result to reflect the new version
    context.result = {
      ...result,
      currentVersionId: version.id,
    };

    return context;
  };
};
