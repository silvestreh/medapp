import { Hook, HookContext } from '@feathersjs/feathers';
import { NotFound } from '@feathersjs/errors';

interface Options {
  service: string;
  fkey: string;
}

export const omitForDeleted = (options: Options): Hook => {
  return async (context: HookContext) => {
    const { app, method, result } = context;

    const checkSoftDelete = async (item: any) => {
      let relatedRecord;

      try {
        relatedRecord = await app.service(options.service).get(item[options.fkey], { disableSoftDelete: true });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-unused-vars
        relatedRecord = { deleted: true };
      }

      if (relatedRecord.deleted) {
        if (method === 'find') {
          return false;
        } else if (method === 'get') {
          throw new NotFound('Record not found');
        }
      }
      return true;
    };

    if (method === 'find') {
      if (Array.isArray(result.data)) {
        context.result.data = await Promise.all(result.data.filter(checkSoftDelete));
      } else if (Array.isArray(result)) {
        context.result = await Promise.all(result.filter(checkSoftDelete));
      }
    } else if (method === 'get') {
      await checkSoftDelete(result);
    }

    return context;
  };
};
